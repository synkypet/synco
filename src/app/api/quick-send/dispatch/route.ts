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

    console.log(`[QUICK-SEND-API] Recebida solicitação de despacho manual validada para user ${userId}...`);

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
    console.error('[QUICK-SEND-API] Erro crítico no despacho:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno no despacho manual' }, 
      { status: 500 }
    );
  }
}
