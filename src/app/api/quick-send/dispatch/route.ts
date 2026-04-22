// src/app/api/quick-send/dispatch/route.ts
import { NextResponse } from 'next/server';
import { campaignService } from '@/services/supabase/campaign-service';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const { userId, campaignData } = await req.json();

    if (!userId || !campaignData) {
      return NextResponse.json({ error: 'Payload incompleto' }, { status: 400 });
    }

    console.log(`[QUICK-SEND-API] Recebida solicitação de despacho manual para user ${userId}...`);

    // ─── BILLING ENFORCEMENT (Fase 2) ──────────────────────────────────────────
    const { resolveUserAccess } = await import('@/services/supabase/access-service');
    const access = await resolveUserAccess(userId);

    if (!access.isOperative) {
      console.warn(`[QUICK-SEND-API] Acesso negado para user ${userId}. Status: ${access.status}`);
      return NextResponse.json({ 
        error: 'Acesso Operacional Restrito', 
        code: 'BILLING_RESTRICTED',
        accessResolution: access.status,
        message: 'Seu plano atual ou status de pagamento não permite realizar novos disparos.'
      }, { status: 403 });
    }

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
