
import { SupabaseClient } from '@supabase/supabase-js';
import { automationService } from '@/services/supabase/automation-service';
import { marketplaceService } from '@/services/supabase/marketplace-service';
import { ShopeeAffiliateClient } from '@/lib/shopee-affiliate/client';
import { extractOfferName } from '@/lib/utils';
import { campaignService } from '@/services/supabase/campaign-service';
import { triggerWorker } from '@/lib/worker/trigger';
import { resolveUserAccess } from '@/services/supabase/access-service';

export interface CouponDispatchResult {
  jobsCreated: number;
}

export const shopeeCouponDispatcher = {
  /**
   * Distribui cupons e campanhas ativas da Shopee para os grupos configurados.
   */
  async executeDispatch(
    supabase: SupabaseClient,
    options: { requestId?: string } = {}
  ): Promise<CouponDispatchResult> {
    const rid = options.requestId || Math.random().toString(36).substring(7);
    const logPrefix = `[COUPON-DISPATCHER] [${rid}]`;

    console.log(`${logPrefix} Iniciando ciclo de despacho de cupons...`);

    // 1. Buscar todas as fontes de Cupom ativas
    const { data: sources } = await supabase
      .from('automation_sources')
      .select(`
        *,
        automation_routes (
          id,
          target_type,
          target_id,
          filters,
          template_config
        )
      `)
      .eq('source_type', 'coupon_shopee')
      .eq('is_active', true);

    if (!sources || sources.length === 0) {
      console.log(`${logPrefix} Nenhuma automação de cupons ativa encontrada.`);
      return { jobsCreated: 0 };
    }

    let totalCreated = 0;
    const userAccessCache = new Map<string, any>();
    const userConnectionsCache = new Map<string, any[]>();

    for (const source of sources) {
      const userTag = `[USER:${source.user_id.substring(0,8)}]`;
      const sourceLogPrefix = `${logPrefix} ${userTag}`;

      const routes = source.automation_routes || [];
      if (routes.length === 0) continue;

      // --- 1. BILLING & ACCESS ---
      let access = userAccessCache.get(source.user_id);
      if (!access) {
        access = await resolveUserAccess(source.user_id, supabase);
        userAccessCache.set(source.user_id, access);
      }
      if (!access.isOperative) {
        console.warn(`${sourceLogPrefix} [SKIP] Usuário não operativo.`);
        continue;
      }

      // --- 2. QUEUE DEPTH CHECK ---
      // Mesmo limite do radar: 10 jobs pendentes com origin 'coupon'
      const { count: pendingCount } = await supabase
        .from('send_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', source.user_id)
        .eq('status', 'pending')
        .eq('origin', 'coupon');

      const MAX_PENDING = 10;
      if (pendingCount !== null && pendingCount >= MAX_PENDING) {
        console.log(`${sourceLogPrefix} Fila de cupons cheia (${pendingCount}/${MAX_PENDING}).`);
        continue;
      }
      let userQuota = MAX_PENDING - (pendingCount || 0);

      // --- 3. SHOPEE CREDENTIALS ---
      let connections = userConnectionsCache.get(source.user_id);
      if (!connections) {
        connections = await marketplaceService.getEnrichedConnections(source.user_id, supabase);
        userConnectionsCache.set(source.user_id, connections);
      }
      const shopeeConn = connections.find(c => c.marketplace_name === 'Shopee');
      if (!shopeeConn || !shopeeConn.shopee_app_id || !shopeeConn.shopee_app_secret) {
        console.warn(`${sourceLogPrefix} [SKIP] Shopee não configurada.`);
        continue;
      }

      // --- 4. FETCH OFFERS ---
      const shopeeClient = new ShopeeAffiliateClient({
        appId: shopeeConn.shopee_app_id,
        secret: shopeeConn.shopee_app_secret
      });

      try {
        const config = source.config || {};
        const sortType = config.sortType || 1;
        const offerTypeFilter = config.offerTypeFilter || 'all'; // all, collection, category
        const minCommission = config.minCommission ? parseFloat(config.minCommission) : 0;

        const { nodes: offers } = await shopeeClient.fetchOffers({ 
          sortType,
          limit: 20 
        });

        if (!offers || offers.length === 0) continue;

        // Processamento de ofertas
        for (const offer of offers) {
          if (userQuota <= 0) break;

          // Filtro por tipo
          if (offerTypeFilter === 'collection' && offer.offerType !== 1) continue;
          if (offerTypeFilter === 'category' && offer.offerType !== 2) continue;

          // Filtro por comissão
          const commissionPercent = parseFloat(offer.commissionRate || '0') * 100;
          if (minCommission > 0 && commissionPercent < minCommission) continue;

          // Deduplicação por rota
          for (const route of routes) {
            if (userQuota <= 0) break;

            const hashKey = this.generateHash(`coupon:${offer.offerLink}:${route.target_id}`);
            const isDuplicate = await automationService.handleDedupeWithTTL(hashKey, 168, supabase);

            if (isDuplicate) continue;

            // Criar Campanha/Job
            try {
              const cleanName = extractOfferName(offer.offerName);
              const periodEndFormatted = offer.periodEndTime 
                ? new Date(offer.periodEndTime * 1000).toLocaleDateString('pt-BR')
                : 'Indeterminado';

              const caption = [
                `🏷️ ${cleanName}`,
                `💰 Comissão: ${commissionPercent.toFixed(1)}%`,
                `⏰ Válido até: ${periodEndFormatted}`,
                '',
                `👉 ${offer.offerLink}`
              ].join('\n');

              const campaignData = {
                name: `CUPOM: ${cleanName.substring(0, 30)}`,
                origin: 'coupon' as any,
                destinations: [{
                  type: route.target_type,
                  id: route.target_id
                }],
                items: [{
                  product_name: cleanName,
                  custom_text: caption,
                  image_url: offer.imageUrl,
                  affiliate_url: offer.offerLink,
                  eligibility_status: 'eligible' as const,
                  eligibility_reasons: []
                }]
              };

              const campaign = await campaignService.create(source.user_id, campaignData, supabase);
              
              await automationService.logEvent({
                source_id: source.id,
                user_id: source.user_id,
                status: 'processed',
                event_type: 'coupon_dispatch',
                details: { 
                  campaignId: campaign.id,
                  offerName: cleanName,
                  routeId: route.id
                }
              }, supabase);

              totalCreated++;
              userQuota--;
              console.log(`${sourceLogPrefix} [DISPATCHED] Cupom "${cleanName}" enviado para ${route.target_id}`);
            } catch (err: any) {
              console.error(`${sourceLogPrefix} Erro ao criar campanha de cupom:`, err.message);
            }
          }
        }
      } catch (err: any) {
        console.error(`${sourceLogPrefix} Erro ao buscar ofertas:`, err.message);
      }
    }

    if (totalCreated > 0) {
      await triggerWorker({ requestId: rid });
    }

    console.log(`${logPrefix} Ciclo finalizado. Total de jobs criados: ${totalCreated}`);
    return { jobsCreated: totalCreated };
  },

  generateHash(input: string) {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
};
