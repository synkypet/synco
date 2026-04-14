import { automationService } from '@/services/supabase/automation-service';
import { AutomationRoute } from '@/types/automation';
import { marketplaceService } from '@/services/supabase/marketplace-service';
import { processLinks, ProductSnapshot } from '@/lib/linkProcessor';
import { campaignService } from '@/services/supabase/campaign-service';
import { createAdminClient } from '@/lib/supabase/admin';
import { fillTemplate } from './template-engine';
import { SupabaseClient } from '@supabase/supabase-js';
import { Marketplace, UserMarketplaceConnection } from '@/types/marketplace';

export interface InboundPayload {
  userId: string;
  channelId: string;
  externalGroupId: string;
  messageId: string;
  body: string;
  isFromMe: boolean;
}

/**
 * Filtros de Automação (Fase 2)
 */
function applyFilters(snapshot: ProductSnapshot, originalBody: string, filters?: AutomationRoute['filters']): boolean {
  if (!filters) return true;

  const factual = snapshot.factual;
  const productTitle = (factual.title || "").toLowerCase();
  const shopName = (factual.shopName || "").toLowerCase();
  const category = (factual as any).category ? (factual as any).category.toLowerCase() : "";
  const messageBody = originalBody.toLowerCase();

  // 1. Filtro de Preço Mínimo
  if (filters.min_price && factual.currentPriceFactual && factual.currentPriceFactual < filters.min_price) {
    console.log(`[FILTER] Price too low: ${factual.currentPriceFactual} < ${filters.min_price}`);
    return false;
  }

  // 2. Filtro de Comissão Mínima
  if (filters.min_commission_rate && factual.commissionRate && (factual.commissionRate * 100) < filters.min_commission_rate) {
    console.log(`[FILTER] Commission too low: ${factual.commissionRate * 100}% < ${filters.min_commission_rate}%`);
    return false;
  }

  // 3. Blacklist de Keywords (Título, Loja, Categoria e Texto Original)
  if (filters.keywords_blacklist && filters.keywords_blacklist.length > 0) {
    const hasBlacklisted = filters.keywords_blacklist.some((word: string) => {
      const w = word.toLowerCase().trim();
      return productTitle.includes(w) || shopName.includes(w) || category.includes(w) || messageBody.includes(w);
    });
    if (hasBlacklisted) {
      console.log(`[FILTER] Blacklisted keyword found`);
      return false;
    }
  }

  // 4. Whitelist de Keywords
  if (filters.keywords_whitelist && filters.keywords_whitelist.length > 0) {
    const hasWhitelisted = filters.keywords_whitelist.some((word: string) => {
      const w = word.toLowerCase().trim();
      return productTitle.includes(w) || shopName.includes(w) || category.includes(w) || messageBody.includes(w);
    });
    if (!hasWhitelisted) {
      console.log(`[FILTER] No whitelisted keyword found`);
      return false;
    }
  }

  return true;
}

/**
 * Extrai links da Shopee de um texto.
 */
function extractShopeeLinks(text: string): string[] {
  const shopeeRegex = /https?:\/\/(?:[a-zA-Z0-9-]+\.)?shopee\.com\.br\/[^\s]+|https?:\/\/shope\.ee\/[^\s]+/gi;
  const matches = text.match(shopeeRegex);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Normaliza uma URL da Shopee.
 */
function normalizeShopeeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = ''; 
    return u.toString().toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export async function processInboundAutomation(payload: InboundPayload) {
  const { userId, channelId, externalGroupId, body, isFromMe } = payload;
  const logPrefix = `[AUTOMATION] [${externalGroupId}]`;

  console.log(`${logPrefix} >>> Iniciando processamento de mensagem:`, { userId, messageId: payload.messageId, isFromMe });

  if (isFromMe) {
    console.log(`${logPrefix} Ignorando: Mensagem enviada pelo próprio número.`);
    return { skipped: 'self_sent' };
  }

  const supabase: SupabaseClient = createAdminClient();
  
  console.log(`${logPrefix} Buscando fonte de automação configurada...`);
  const source = await automationService.getSourceByExternalId(userId, channelId, externalGroupId, supabase);
  
  if (!source) {
    console.warn(`${logPrefix} ⚠ Nenhuma fonte ativa encontrada para este grupo.`);
    return { skipped: 'not_a_source' };
  }

  console.log(`${logPrefix} ✓ Fonte encontrada: "${source.name}" (ID: ${source.id})`);

  const links = extractShopeeLinks(body);
  if (links.length === 0) {
    console.log(`${logPrefix} Ignorando: Nenhum link Shopee identificado no texto.`);
    return { skipped: 'no_shopee_links' };
  }

  console.log(`${logPrefix} ✓ ${links.length} link(s) Shopee encontrado(s).`);

  const connections: UserMarketplaceConnection[] = await marketplaceService.getUserConnections(userId, supabase);
  console.log(`${logPrefix} Buscando rotas de destino...`);
  const routes = await automationService.getRoutesBySourceId(source.id, supabase);
  
  if (routes.length === 0) {
    console.warn(`${logPrefix} ⚠ Nenhuma rota de destino ativa configurada para esta fonte.`);
    await automationService.logEvent({
      source_id: source.id,
      user_id: userId,
      status: 'filtered',
      event_type: 'no_routes',
      details: { channelId, externalGroupId }
    }, supabase);
    return { skipped: 'no_routes_configured' };
  }

  console.log(`${logPrefix} ✓ ${routes.length} rota(s) de destino configurada(s).`);

  const results = [];
  const adminEntry = supabase;

  // Buscar IDs remotos dos destinos para o Anti-loop
  const { data: routeDestinations } = await adminEntry
    .from('groups')
    .select('id, remote_id')
    .in('id', routes.map(r => r.target_id));

  for (const rawUrl of links) {
    const normalized = normalizeShopeeUrl(rawUrl);
    console.log(`${logPrefix} Processando link: ${rawUrl}`);
    
    // Camada 1: Dedupe de Ingestão
    const isDuplicate = await automationService.checkAndMarkDedupe(userId, normalized, externalGroupId, supabase);
    if (isDuplicate) {
      console.log(`${logPrefix} [DEDUPE] URL já processada recentemente para este grupo.`);
      await automationService.logEvent({
        source_id: source.id,
        user_id: userId,
        status: 'filtered',
        event_type: 'ingest_dedupe',
        details: { url: normalized }
      }, supabase);
      continue;
    }

    try {
      console.log(`${logPrefix} Convertendo link para afiliado e buscando metadados...`);
      const snapshots = await processLinks([rawUrl], connections, 'auto');
      const snapshot = snapshots[0];

      if (!snapshot) {
        console.error(`${logPrefix} ✖ Falha ao capturar metadados do produto.`);
        await automationService.logEvent({
          source_id: source.id,
          user_id: userId,
          status: 'error',
          event_type: 'fetch_failed',
          details: { url: normalized }
        }, supabase);
        continue;
      }

      console.log(`${logPrefix} ✓ Produto: "${snapshot.factual.title}" | Preço: ${snapshot.factual.currentPriceFactual}`);

      // Processar cada rota individualmente
      for (const route of routes) {
        console.log(`${logPrefix} -> Verificando rota de destino: ${route.target_id}`);
        
        // 1. Anti-loop
        const destInfo = routeDestinations?.find(d => d.id === route.target_id);
        if (destInfo?.remote_id === externalGroupId) {
          console.log(`${logPrefix} [ANTI-LOOP] Ignorando: Destino é o próprio grupo de origem.`);
          await automationService.logEvent({
            source_id: source.id,
            user_id: userId,
            status: 'filtered',
            event_type: 'anti_loop',
            details: { url: normalized, targetId: route.target_id }
          }, supabase);
          continue;
        }

        // 2. Motor de Regras: Filtros
        if (!applyFilters(snapshot, body, route.filters)) {
          console.log(`${logPrefix} [REGRAS] Link rejeitado pelos filtros da rota.`);
          await automationService.logEvent({
            source_id: source.id,
            user_id: userId,
            status: 'filtered',
            event_type: 'rule_rejected',
            details: { url: normalized, targetId: route.target_id, filters: route.filters }
          }, supabase);
          continue;
        }

        // 3. Camada 2: Dedupe de Destino
        const isDestDuplicate = await automationService.checkAndMarkDestinationDedupe(userId, normalized, route.target_id, supabase);
        if (isDestDuplicate) {
          console.log(`${logPrefix} [DEDUPE-DEST] URL já enviada para este destino recentemente.`);
          await automationService.logEvent({
            source_id: source.id,
            user_id: userId,
            status: 'filtered',
            event_type: 'dest_dedupe',
            details: { url: normalized, targetId: route.target_id }
          }, supabase);
          continue;
        }

        // 4. Composição e Geração de Job
        console.log(`${logPrefix} Gerando campanha e jobs de envio...`);
        const finalMessage = route.template_config?.body 
          ? fillTemplate(route.template_config.body, snapshot.factual, source.name)
          : snapshot.copy.messageText;

        const campaign = await campaignService.create(userId, {
          name: `AUTO: ${snapshot.factual.title.substring(0, 30)}...`,
          items: [{
            product_id: (snapshot.factual.itemId || snapshot.id).toString(),
            product_name: snapshot.factual.title,
            custom_text: finalMessage,
            affiliate_url: snapshot.factual.finalLinkToSend,
            image_url: snapshot.factual.image || undefined
          }],
          destinations: [{
            type: route.target_type,
            id: route.target_id
          }]
        }, supabase);

        console.log(`${logPrefix} ★ SUCESSO! Campanha #${campaign.id} criada para o destino.`);

        await automationService.logEvent({
          source_id: source.id,
          user_id: userId,
          status: 'processed',
          event_type: 'job_created',
          details: { url: normalized, targetId: route.target_id, campaignId: campaign.id }
        }, supabase);

        results.push({ url: normalized, routeId: route.id, campaignId: campaign.id });
      }

    } catch (err: any) {
      console.error(`${logPrefix} ✖ Erro crítico no processamento:`, err);
      await automationService.logEvent({
        source_id: source.id,
        user_id: userId,
        status: 'error',
        event_type: 'exception',
        details: { url: normalized, error: err.message }
      }, supabase);
    }
  }

  console.log(`${logPrefix} Finalizado: ${results.length} item(s) processado(s) com sucesso.`);
  return { processed: results.length, details: results };
}
