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

    const { planId, planSlug } = await request.json();

    if (!planId && !planSlug) {
      return NextResponse.json({ error: 'Missing planId or planSlug' }, { status: 400 });
    }

    // Buscando dados do plano oficial do DB
    const adminSupabase = createAdminClient();
    const query = adminSupabase.from('plans').select('*');
    
    if (planId) {
      query.eq('id', planId);
    } else {
      query.eq('slug', planSlug);
    }

    const { data: plan, error: planError } = await query.single();

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    const backUrl = `${process.env.NEXT_PUBLIC_APP_URL}/billing`;
    const notificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/mercado-pago`;

    // Metadados importantes injetados no external_reference
    const externalReference = `usr_${user.id}|pln_${plan.id}`;

    const preapproval = await mercadoPagoClient.createSubscription({
      reason: `SYNCO - Plano ${plan.name}`,
      external_reference: externalReference,
      payer_email: user.email || 'customer@synco.app',
      transaction_amount: plan.price_monthly || 59.00,
      back_url: backUrl,
      notification_url: notificationUrl
    });

    return NextResponse.json({ 
      checkoutUrl: preapproval.init_point 
    });

  } catch (error: any) {
    console.error("[BILLING_CHECKOUT] Error:", error.message);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
