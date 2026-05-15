// src/lib/marketplaces/shopee/coupon-automation-dispatch.test.ts
import { capturedCouponDispatcher } from '../../../services/captured-coupon-dispatcher';
import { campaignService } from '../../../services/supabase/campaign-service';
import { automationService } from '../../../services/supabase/automation-service';
import { ShopeeAdapter } from '../ShopeeAdapter';

async function runTests() {
  console.log('--- INICIANDO TESTES DE AUTOMAÇÃO DE CUPONS CAPTURADOS ---\n');
  let passed = 0;
  let failed = 0;

  const mockSupabase = {
    from: jestMockFrom
  } as any;

  // Helpers para Mocks manuais (já que não estamos usando Jest runner)
  function jestMockFrom(table: string) {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      gte: () => chain,
      order: () => chain,
      maybeSingle: () => Promise.resolve({ data: getMockData(table, true) }),
      single: () => Promise.resolve({ data: getMockData(table, true) }),
      insert: () => Promise.resolve({ data: { id: 'new-id' }, error: null }),
      then: (resolve: any) => resolve({ data: getMockData(table) })
    };
    return chain;
  }

  let mockData: any = {};
  function getMockData(table: string, single = false) {
    const data = mockData[table] || [];
    return single ? data[0] : data;
  }

  // Mocks de Serviços
  const originalCheck = automationService.checkCouponDispatch;
  const originalRegister = automationService.registerCouponDispatch;
  const originalCampaignCreate = campaignService.create;
  const originalPreProcess = ShopeeAdapter.prototype.preProcessIncomingLink;

  try {
    // --- CENÁRIO A: Cupom Novo ---
    console.log('Cenário A: Automação ativa + cupom novo');
    mockData = {
      automation_sources: [{
        id: 'source-1', user_id: 'user-1', source_type: 'captured_coupons_shopee', is_active: true,
        automation_routes: [{ id: 'route-1', target_type: 'group', target_id: 'group-1', is_active: true }]
      }],
      discovered_coupons: [{
        id: 'coupon-1', user_id: 'user-1', code: 'CUPOM10', coupon_label: '10% OFF',
        redemption_url: 'https://shope.ee/test', status: 'candidate', last_seen_at: new Date().toISOString()
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

    automationService.checkCouponDispatch = async () => false;
    automationService.registerCouponDispatch = async () => {};
    campaignService.create = async (uid, dto) => {
      if (dto.origin === 'automation_coupon' && dto.metadata?.couponId === 'coupon-1') return { id: 'camp-1' } as any;
      throw new Error('Campanha inválida');
    };
    ShopeeAdapter.prototype.preProcessIncomingLink = async () => ({
      reaffiliation_status: 'reaffiliated',
      generated_affiliate_url: 'https://s.shopee.com.br/aff'
    });

    const resA = await capturedCouponDispatcher.executeDispatch(mockSupabase);
    if (resA.jobsCreated === 1) {
      console.log('  [PASS]');
      passed++;
    } else {
      console.error('  [FAIL] Deveria ter criado 1 job');
      failed++;
    }

    // --- CENÁRIO B: Mesmo cupom para mesmo destino ---
    console.log('Cenário B: Mesmo cupom para mesmo destino');
    automationService.checkCouponDispatch = async () => true;
    const resB = await capturedCouponDispatcher.executeDispatch(mockSupabase);
    if (resB.jobsCreated === 0) {
      console.log('  [PASS]');
      passed++;
    } else {
      console.error('  [FAIL] Não deveria reenviar');
      failed++;
    }

    // --- CENÁRIO D: Cupom sem código e sem link ---
    console.log('Cenário D: Cupom sem código e sem link');
    automationService.checkCouponDispatch = async () => false;
    mockData.discovered_coupons[0].code = null;
    mockData.discovered_coupons[0].redemption_url = null;
    const resD = await capturedCouponDispatcher.executeDispatch(mockSupabase);
    if (resD.jobsCreated === 0) {
      console.log('  [PASS]');
      passed++;
    } else {
      console.error('  [FAIL] Deveria bloquear cupom vazio');
      failed++;
    }

  } catch (err: any) {
    console.error('Erro fatal nos testes:', err);
    failed++;
  } finally {
    // Restaurar originais
    automationService.checkCouponDispatch = originalCheck;
    automationService.registerCouponDispatch = originalRegister;
    campaignService.create = originalCampaignCreate;
    ShopeeAdapter.prototype.preProcessIncomingLink = originalPreProcess;
  }

  console.log(`\n--- RESULTADO FINAL ---`);
  console.log(`Sucessos: ${passed}`);
  console.log(`Falhas: ${failed}`);

  if (failed > 0) process.exit(1);
}

// Mocking dependencies that use environment variables or complex logic
// This is minimal to avoid real API calls
jest: {
  mock: (path: string, fn: any) => {}
}

runTests();
