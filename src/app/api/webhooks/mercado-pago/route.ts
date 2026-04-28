import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { mercadoPagoClient } from '@/lib/mercado-pago/client';
import { normalizeMercadoPagoSubscriptionStatus } from '@/types/billing';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const dataId = url.searchParams.get('data.id') || url.searchParams.get('id');
    const type = url.searchParams.get('type') || url.searchParams.get('topic');

    // Headers de segurança
    const xSignature = request.headers.get('x-signature');
    const xRequestId = request.headers.get('x-request-id');

    // 1. Validar Assinatura do MP Oficialmente
    const isValid = mercadoPagoClient.validateWebhookSignature(xSignature, xRequestId, dataId);
    
    // No ambiente local, caso não haja ngrok, desenvolvedores podem testar desabilitando isso.
    // Mas em prod é estritamente false a menos que passe no HMAC.
    if (!isValid && process.env.NODE_ENV === 'production') {
      console.warn("[MP_WEBHOOK] Assinatura HMAC rejeitada.");
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const body = await request.json();
    const eventId = dataId || xRequestId || body.id?.toString();

    if (!eventId) {
      return NextResponse.json({ error: 'Missing Event ID' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 2. Idempotência: Gravar evento ou falhar se existir (HTTP 200 pro MP parar de mandar)
    const { error: insertError } = await supabase
      .from('billing_events')
      .insert({
        provider: 'mercado_pago',
        event_id: eventId,
        event_type: type,
        payload: body,
      });

    if (insertError) {
      if (insertError.code === '23505') { // Unique Violation
        console.log(`[MP_WEBHOOK] Evento ${eventId} já processado. Ignorando silenciosamente.`);
        return NextResponse.json({ received: true });
      }
      throw insertError;
    }

    // 3. Resolução Segura de Payload Oficial (Não confiar apenas no webhook)
    if (type === 'subscription_preapproval') {
      // É um evento de assinatura. Vamos consultar o MP oficial.
      const preapproval = await mercadoPagoClient.getSubscription(dataId as string);
      
      const externalReference = preapproval.external_reference; 
      // Ex: usr_dadasdasd|pln_dasdasdasd
      if (!externalReference || !externalReference.includes('|')) {
        console.warn("[MP_WEBHOOK] Assinatura sem external_reference válida. Ignorando update no BD.");
        await markProcessed(supabase, eventId);
        return NextResponse.json({ received: true });
      }

      const [usrPart, plnPart] = externalReference.split('|');
      const userId = usrPart.replace('usr_', '');
      const planId = plnPart.replace('pln_', '');

      const cleanStatus = normalizeMercadoPagoSubscriptionStatus(preapproval.status);

      // Grace Period Logic (Se a API cancelar ou ficar past due)
      let gracePeriodEnd = null;
      if (cleanStatus === 'past_due' && preapproval.next_payment_date) {
        const nextPayment = new Date(preapproval.next_payment_date);
        nextPayment.setDate(nextPayment.getDate() + 3); // 3 days grace
        gracePeriodEnd = nextPayment.toISOString();
      }

      const upsertData: any = {
        user_id: userId,
        plan_id: planId,
        status: cleanStatus,
        provider: 'mercado_pago',
        provider_subscription_id: preapproval.id,
        provider_status: preapproval.status,
        metadata: preapproval,
        updated_at: new Date().toISOString()
      };

      if (cleanStatus === 'canceled' || cleanStatus === 'expired') {
          upsertData.canceled_at = new Date().toISOString();
      }
      
      if (gracePeriodEnd) {
          upsertData.grace_period_end = gracePeriodEnd;
      }

      if (preapproval.reason) {
          upsertData.current_period_start = preapproval.date_created; 
          // Idealmente buscar faturas, mas MVP assume renovação pela data no preapproval.
      }

      // Supabase só permite um row por user_id na table de subscriptions (UNIQUE constr)
      // Upsert fará a mágica substituindo se o mesmo usuário fizer novo plano, sobrepondo o velho.
      const { error: upsertError } = await supabase
        .from('subscriptions')
        .upsert(upsertData, { onConflict: 'user_id' });

      if (upsertError) {
        console.error("[MP_WEBHOOK] Erro ao gravar Subscription:", upsertError.message);
      }
    } 
    else if (type === 'payment') {
      // Ignorando updates granulares de "fatura" isolada no MVP por enquanto.
      // O MP atualiza o objeto do preapproval globalmente ao aprovar/recusar o payment amarrado.
    }

    await markProcessed(supabase, eventId);
    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error("[MP_WEBHOOK_ERROR]", error);
    // Erros 500 informam ao provedor para dar Retry
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function markProcessed(supabase: any, eventId: string) {
  await supabase
    .from('billing_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('provider', 'mercado_pago');
}
