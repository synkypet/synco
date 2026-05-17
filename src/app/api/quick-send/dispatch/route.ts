// src/app/api/quick-send/dispatch/route.ts
import { NextResponse } from 'next/server';
import { campaignService } from '@/services/supabase/campaign-service';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOperationalAccess, requireSendLimit } from '@/lib/access/require-operational-access';

export async function POST(req: Request) {
  try {
    // 1. e 2. Autenticar usuário pela sessão e IGNORAR qualquer userId do body
    const gate = await requireOperationalAccess();
    if (!gate.ok) return gate.response;

    const { user, access } = gate;
    const userId = user.id; // SSOT (Single Source of Truth)

    // Body parser (ignoramos o userId fornecido)
    const body = await req.json();
    const campaignData = body.campaignData;

    if (!campaignData || !campaignData.items || !campaignData.destinations) {
      return NextResponse.json({ error: 'Payload incompleto' }, { status: 400 });
    }

    // Se qualquer item falhou com coupon_id_not_found → abortar todo o despacho
    if (campaignData.items && Array.isArray(campaignData.items)) {
      const failed = campaignData.items.filter((item: any) => 
        item.eligibility_status === 'ineligible' && 
        item.eligibility_reasons?.includes('coupon_id_not_found')
      );
      if (failed.length > 0) {
        console.warn(`[QUICK-SEND-API] Despacho manual abortado devido a cupons não encontrados no banco de dados para user ${userId}:`, failed);
        return NextResponse.json({
          error: 'dispatch_aborted',
          message: 'Um ou mais cupons solicitados não foram encontrados no banco de dados.',
          failed
        }, { status: 422 });
      }
    }

    console.log(`[QUICK-SEND-API] Recebida solicitação de despacho manual validada para user ${userId}...`);

    // Log obrigatório de auditoria
    if (campaignData.items && Array.isArray(campaignData.items)) {
      for (const item of campaignData.items) {
        if (item.offer_type === 'coupon_offer') {
          // Extrair código e link da mensagem se possível, ou usar os metadados do payload
          const codeMatch = item.custom_text?.match(/🎟️ Código:\s*\*?([A-Za-z0-9_-]+)\*?/i);
          const finalCode = codeMatch ? codeMatch[1] : null;
          console.log(`[QUICK-SEND-API-AUDIT]`, {
            couponId: item.product_id,
            couponCode: finalCode,
            finalMessageUrl: item.affiliate_url,
            finalMessageCouponLabel: item.product_name
          });
        }
      }
    }

    // 4. Calcular quantidade (Estimativa básica por item x destinos informados)
    const itemsCount = campaignData.items.length;
    const destsCount = campaignData.destinations.length;
    let requestedSends = itemsCount * destsCount;
    // Se quiser expandir listas antes, precisaria bater no DB. 
    // Por hora estimamos com base no payload raw:

    // 5. e 6. Validar limite do plano mensal
    const limitError = await requireSendLimit(userId, requestedSends, access.quotas);
    if (limitError) return limitError;

    // Usar cliente admin para garantir que a expansão de listas e criação de jobs funcione 
    // com bypass de RLS se necessário, mantendo a consistência operacional.
    const supabase = createAdminClient();

    // Chamar o wrapper especializado para isolamento
    const campaign = await campaignService.createQuickSendCampaign(userId, campaignData, supabase);

    console.log(`[QUICK-SEND-API] Despacho manual concluído. Campanha #${campaign.id} criada.`);

    return NextResponse.json(campaign);

  } catch (error: any) {
    console.error('[QUICK-SEND-API] Erro no despacho:', error.message);

    // Mapeamento de erros de segurança controlados para 400 Bad Request
    const controlledErrors = [
      'coupon_manual_confirmation_required',
      'promo_landing_manual_confirmation_required',
      'manual_confirmation_required_for_special_offers'
    ];

    if (controlledErrors.includes(error.message)) {
      return NextResponse.json(
        { error: error.message, message: 'Confirmação manual obrigatória para itens especiais.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'internal_error', message: error.message || 'Erro interno no despacho manual' }, 
      { status: 500 }
    );
  }
}
