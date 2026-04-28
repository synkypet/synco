import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { mercadoPagoClient } from '@/lib/mercado-pago/client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();
    
    // 1. Achar a assinatura vigente do usuário
    const { data: sub, error: subError } = await adminSupabase
      .from('subscriptions')
      .select('provider_subscription_id, id, status, current_period_end')
      .eq('user_id', user.id)
      .not('status', 'eq', 'canceled')
      .not('status', 'eq', 'expired')
      .not('status', 'eq', 'none')
      .single();

    if (subError || !sub || !sub.provider_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found to cancel' }, { status: 404 });
    }

    // 2. Chamar cancelar no Mercado Pago Oficialmente
    await mercadoPagoClient.cancelSubscription(sub.provider_subscription_id);

    // 3. Atualizar o Supabase internamente (Não apagamos a sub, marcamos como canceled e injetamos as datas pra ele aproveitar os ultimos dias)
    // O Webhook do Mercado Pago (subscription_preapproval cancelled) também irá bater, mas garantimos agilidade na UI.
    await adminSupabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString()
      })
      .eq('id', sub.id);

    return NextResponse.json({ 
      success: true,
      message: 'Subscription canceled successfully. Access will be maintained until current_period_end.'
    });

  } catch (error: any) {
    console.error("[BILLING_CANCEL] Error:", error.message);
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
  }
}
