
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 1. Verificar se a simulação está habilitada
    const isEnabled = process.env.BILLING_SIMULATION_ENABLED === 'true';
    if (!isEnabled) {
      return NextResponse.json(
        { error: 'Simulação desabilitada', message: 'Simulação de pagamento não está habilitada neste ambiente.' },
        { status: 403 }
      );
    }

    // 2. Verificar autenticação
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 3. Verificar permissão granular do usuário (Tester)
    const adminSupabase = createAdminClient();
    const { data: tester, error: testerError } = await adminSupabase
      .from('billing_simulation_testers')
      .select('is_enabled')
      .eq('user_id', user.id)
      .single();

    if (testerError || !tester || !tester.is_enabled) {
      return NextResponse.json(
        { error: 'Acesso negado', message: 'Simulação de pagamento não habilitada para este usuário.' },
        { status: 403 }
      );
    }

    const { planId, planSlug } = await request.json();

    if (!planId && !planSlug) {
      return NextResponse.json({ error: 'Faltando planId ou planSlug' }, { status: 400 });
    }

    // 4. Buscar o plano

    const query = adminSupabase.from('plans').select('*').eq('is_active', true);
    
    if (planId) {
      query.eq('id', planId);
    } else {
      query.eq('slug', planSlug);
    }

    const { data: plan, error: planError } = await query.single();

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plano não encontrado ou inativo' }, { status: 404 });
    }

    // 5. Criar/Atualizar Assinatura Simulada
    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(now.getDate() + 30);
    const timestamp = Date.now();

    const subscriptionData = {
      user_id: user.id,
      plan_id: plan.id,
      status: 'active',
      provider: 'simulation',
      provider_subscription_id: `sim_${user.id}_${timestamp}`,
      provider_payment_id: `sim_pay_${timestamp}`,
      provider_status: 'approved',
      current_period_start: now.toISOString(),
      current_period_end: expiresAt.toISOString(),
      updated_at: now.toISOString(),
      metadata: { simulation: true }
    };

    // Usamos upsert baseado no user_id
    const { data: subscription, error: subError } = await adminSupabase
      .from('subscriptions')
      .upsert(subscriptionData, { onConflict: 'user_id' })
      .select()
      .single();

    if (subError) {
      console.error("[SIMULATE_PAYMENT] DB Error:", subError);
      return NextResponse.json({ error: 'Erro ao salvar assinatura' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Pagamento simulado aprovado. Seu plano foi ativado.',
      plan: plan.name,
      subscription
    });

  } catch (error: any) {
    console.error("[SIMULATE_PAYMENT] Unexpected Error:", error.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
