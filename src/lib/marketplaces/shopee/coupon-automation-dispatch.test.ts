
import { capturedCouponDispatcher } from '@/services/captured-coupon-dispatcher';
import { campaignService } from '@/services/supabase/campaign-service';
import { automationService } from '@/services/supabase/automation-service';
import { ShopeeAdapter } from '@/lib/marketplaces/ShopeeAdapter';

async function runTests() {
  console.log('--- INICIANDO TESTES DE AUTOMAÇÃO DE CUPONS CAPTURADOS ---\n');
  let passed = 0;
  let failed = 0;

  const mockSupabase = {
    from: jestMockFrom
  } as any;

  let currentFilters: Record<string, any> = {};
  function jestMockFrom(table: string) {
    currentFilters = {};
    const chain: any = {
      select: () => chain,
      eq: (col: string, val: any) => {
        currentFilters[col] = val;
        return chain;
      },
      in: () => chain,
      gte: () => chain,
      order: () => chain,
      limit: () => chain,
      or: () => chain,
      maybeSingle: () => Promise.resolve({ data: getMockData(table, true) }),
      single: () => Promise.resolve({ data: getMockData(table, true) }),
      insert: () => Promise.resolve({ data: { id: 'new-id' }, error: null }),
      upsert: () => Promise.resolve({ data: null, error: null }),
      update: () => Promise.resolve({ data: null, error: null }),
      then: (resolve: any) => resolve({ data: getMockData(table) })
    };
    return chain;
  }

  let mockData: any = {};
  function getMockData(table: string, single = false) {
    let data = mockData[table] || [];
    
    // Filtro básico para o teste
    if (table === 'automation_sources' && currentFilters.source_type) {
      data = data.filter((d: any) => d.source_type === currentFilters.source_type);
    }
    
    if (table === 'automation_coupon_rules') {
      if (currentFilters.source_id) data = data.filter((d: any) => d.source_id === currentFilters.source_id);
      if (currentFilters.route_id) data = data.filter((d: any) => d.route_id === currentFilters.route_id);
      if (currentFilters.is_selected !== undefined) data = data.filter((d: any) => d.is_selected === currentFilters.is_selected);
      if (currentFilters.is_active !== undefined) data = data.filter((d: any) => d.is_active === currentFilters.is_active);
    }
    
    return single ? data[0] : data;
  }

  // Mocks de Serviços
  const originalCheck = automationService.checkCouponDispatch;
  const originalCheckGlobal = (automationService as any).checkGlobalTargetCouponDispatch;
  const originalRegister = automationService.registerCouponDispatch;
  const originalCampaignCreate = campaignService.create;
  const originalPreProcess = ShopeeAdapter.prototype.preProcessIncomingLink;
  const originalSync = automationService.syncRulesFromCandidates;
  const originalUpdateRule = automationService.updateCouponRule;

  try {
    // --- CENÁRIO A: Cupom Novo ---
    console.log('Cenário A: Automação ativa + cupom novo (regra selecionada)');
    mockData = {
      automation_sources: [{
        id: 'source-1', user_id: 'user-1', source_type: 'captured_coupons_shopee', is_active: true,
        automation_routes: [{ id: 'route-1', target_type: 'group', target_id: 'group-1', is_active: true }]
      }],
      discovered_coupons: [{
        id: 'coupon-1', user_id: 'user-1', code: 'CUPOM10', coupon_label: '10% OFF',
        redemption_url: 'https://shope.ee/test', status: 'candidate', last_seen_at: new Date().toISOString()
      }],
      automation_coupon_rules: [{
        id: 'rule-1', source_id: 'source-1', route_id: 'route-1', coupon_id: 'coupon-1', 
        item_type: 'coupon', is_selected: true, is_active: true, interval_minutes: 60,
        coupon: {
          id: 'coupon-1', user_id: 'user-1', code: 'CUPOM10', coupon_label: '10% OFF',
          redemption_url: 'https://shope.ee/test', status: 'candidate'
        }
      }],
      internal_licenses: [{ user_id: 'user-1', role: 'admin' }],
      user_marketplaces: [{ 
        user_id: 'user-1', 
        marketplace_id: 'shopee-id',
        is_active: true,
        shopee_app_id: 'app-123',
        marketplaces: { name: 'Shopee' }
      }],
      marketplaces: [{ id: 'shopee-id', name: 'Shopee' }],
      user_marketplace_secrets: [{ marketplace_id: 'shopee-id', encrypted_secret: '...', iv: '...', auth_tag: '...' }]
    };

    const { marketplaceService } = require('../../../services/supabase/marketplace-service');
    marketplaceService.getEnrichedConnections = async () => [{
      marketplace_name: 'Shopee',
      shopee_app_id: 'app-123',
      shopee_app_secret: 'secret-123'
    }];

    automationService.syncRulesFromCandidates = async () => {};
    automationService.updateCouponRule = async () => {};
    
    automationService.checkCouponDispatch = async (uid: string, cid: string, rid: string, tid: string, key: string) => {
      return (mockData.automation_coupon_dispatches || []).some((d: any) => 
        d.user_id === uid && d.coupon_id === cid && d.target_id === tid && d.cycle_key === key
      );
    };

    (automationService as any).checkGlobalTargetCouponDispatch = async (uid: string, cid: string, tid: string) => {
      return (mockData.automation_coupon_dispatches || []).some((d: any) => 
        d.user_id === uid && d.coupon_id === cid && d.target_id === tid && d.status === 'sent'
      );
    };

    automationService.registerCouponDispatch = async (d) => {
      mockData.automation_coupon_dispatches = mockData.automation_coupon_dispatches || [];
      mockData.automation_coupon_dispatches.push(d);
    };
    campaignService.create = async (uid, dto) => {
      if (dto.origin === 'automation_coupon' && dto.metadata?.couponId === 'coupon-1') return { id: 'camp-1' } as any;
      throw new Error('Campanha inválida');
    };
    ShopeeAdapter.prototype.preProcessIncomingLink = async () => ({
      reaffiliation_status: 'reaffiliated',
      generated_affiliate_url: 'https://s.shopee.com.br/aff'
    });

    const resA = await capturedCouponDispatcher.executeDispatch(mockSupabase, { services: { automationService } });
    if (resA.jobsCreated === 1 && resA.sourcesProcessed === 1) {
      console.log('  [PASS]');
      passed++;
    } else {
      console.error('  [FAIL] Deveria ter criado 1 job e processado 1 source');
      console.error('  Res:', resA);
      failed++;
    }

    // --- CENÁRIO B: Dedupe Global por Destino ---
    console.log('Cenário B: Dedupe Global por Destino (mesmo destino, automação diferente)');
    automationService.checkCouponDispatch = async () => false; // Rota limpa
    (automationService as any).checkGlobalTargetCouponDispatch = async () => true; // Já enviado globalmente
    const resB = await capturedCouponDispatcher.executeDispatch(mockSupabase, { services: { automationService } });
    if (resB.jobsCreated === 0 && resB.skippedByGlobalTargetDedupe === 1) {
      console.log('  [PASS]');
      passed++;
    } else {
      console.error('  [FAIL] Deveria ter skipado por Global Dedupe');
      failed++;
    }

    // --- CENÁRIO C: Rota Inativa ---
    console.log('Cenário C: Rota inativa');
    (automationService as any).checkGlobalTargetCouponDispatch = async () => false;
    mockData.automation_sources[0].automation_routes[0].is_active = false;
    const resC = await capturedCouponDispatcher.executeDispatch(mockSupabase, { services: { automationService } });
    if (resC.jobsCreated === 0 && resC.sourcesProcessed === 1) {
      console.log('  [PASS]');
      passed++;
    } else {
      console.error('  [FAIL] Rota inativa não deveria ser processada');
      failed++;
    }
    mockData.automation_sources[0].automation_routes[0].is_active = true;

    // --- CENÁRIO D: Promo Landing Guardrail ---
    console.log('Cenário D: Promo Landing Guardrail (deve pular mesmo se selecionado)');
    mockData.automation_coupon_rules[0].item_type = 'promo_landing';
    mockData.automation_coupon_rules[0].promo_page = { title: 'Ofertas do Dia', url: 'https://shopee.com.br/m/ofertas' };
    
    const resD = await capturedCouponDispatcher.executeDispatch(mockSupabase, { services: { automationService } });
    if (resD.jobsCreated === 0) {
      console.log('  [PASS]');
      passed++;
    } else {
      console.error('  [FAIL] Promo landing não deveria ser disparada automaticamente');
      failed++;
    }
    // Restaurar para cupom
    mockData.automation_coupon_rules[0].item_type = 'coupon';
    mockData.automation_coupon_rules[0].promo_page = null;

    // --- CENÁRIO E: Global Cycle Dedupe (Deduplicação por Ciclo) ---
    console.log('Cenário E: Global Cycle Dedupe (Deduplicação por Ciclo)');
    mockData.automation_coupon_dispatches = [];
    
    // Forçar o mock a retornar true para o cupom-1 neste cenário
    const originalCheck = automationService.checkCouponDispatch;
    automationService.checkCouponDispatch = async (uid, cid, rid, tid, key) => {
      if (key && key.includes('coupon-1')) return true;
      return false;
    };

    const resE = await capturedCouponDispatcher.executeDispatch(mockSupabase, { services: { automationService } });
    
    // Restaurar original
    automationService.checkCouponDispatch = originalCheck;

    if (resE.jobsCreated === 0 && resE.skippedByDedupe === 1) {
      console.log('  [PASS]');
      passed++;
    } else {
      console.error('  [FAIL] Mock de dedupe ignorado ou não funcionou');
      console.error('  Res:', resE);
      failed++;
    }

    // --- CENÁRIO F: Rule Selection & Activity ---
    console.log('Cenário F: Regra não selecionada ou inativa não envia');
    mockData.automation_coupon_dispatches = [];
    mockData.automation_coupon_rules[0].is_selected = false;
    
    const resF1 = await capturedCouponDispatcher.executeDispatch(mockSupabase, { services: { automationService } });
    
    mockData.automation_coupon_rules[0].is_selected = true;
    mockData.automation_coupon_rules[0].is_active = false;
    const resF2 = await capturedCouponDispatcher.executeDispatch(mockSupabase, { services: { automationService } });

    if (resF1.jobsCreated === 0 && resF2.jobsCreated === 0) {
      console.log('  [PASS]');
      passed++;
    } else {
      console.error('  [FAIL] Enviou regra inválida');
      failed++;
    }

  } catch (err: any) {
    console.error('Erro fatal nos testes:', err);
    failed++;
  } finally {
    // Restaurar originais
    automationService.checkCouponDispatch = originalCheck;
    (automationService as any).checkGlobalTargetCouponDispatch = originalCheckGlobal;
    automationService.registerCouponDispatch = originalRegister;
    campaignService.create = originalCampaignCreate;
    ShopeeAdapter.prototype.preProcessIncomingLink = originalPreProcess;
    automationService.syncRulesFromCandidates = originalSync;
    automationService.updateCouponRule = originalUpdateRule;
  }

  console.log(`\n--- RESULTADO FINAL ---`);
  console.log(`Sucessos: ${passed}`);
  console.log(`Falhas: ${failed}`);

  if (failed > 0) process.exit(1);
}

runTests();
