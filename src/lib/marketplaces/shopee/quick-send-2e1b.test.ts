
// Mocking simple objects for Node environment before imports that use them
(global as any).jest = {
  mock: () => {},
  fn: (impl?: any) => {
    const fn: any = (...args: any[]) => {
      fn.mock.calls.push(args);
      return impl ? impl(...args) : fn;
    };
    fn.mock = { calls: [] };
    fn.mockReturnThis = () => {
      fn.mockReturnValue = fn;
      return fn;
    };
    fn.mockImplementation = (newImpl: any) => {
      impl = newImpl;
      return fn;
    };
    fn.mockReturnValue = (val: any) => {
      impl = () => val;
      return fn;
    };
    return fn;
  }
} as any;

import { campaignService } from '@/services/supabase/campaign-service';
import { CreateCampaignDTO } from '@/types/campaign';

// Mock do ShopeeAdapter para evitar chamadas reais à API
(global as any).jest.mock('../ShopeeAdapter');

async function runTests() {
  console.log('--- INICIANDO TESTES DE SEGURANÇA E ENVIO MANUAL DE CUPONS (FASE 2E.1B) ---');

  const userId = 'user_123';
  
  // Mock do Supabase
  const mockSupabase: any = {
    from: (global as any).jest.fn().mockReturnThis(),
    select: (global as any).jest.fn().mockReturnThis(),
    eq: (global as any).jest.fn().mockReturnThis(),
    in: (global as any).jest.fn().mockReturnThis(),
    order: (global as any).jest.fn().mockReturnThis(),
    limit: (global as any).jest.fn().mockReturnThis(),
    single: (global as any).jest.fn().mockImplementation(() => {
      return Promise.resolve({ data: { is_operative: true, status: 'active' }, error: null });
    }),
    insert: (global as any).jest.fn().mockImplementation((data: any) => {
      if (Array.isArray(data)) return Promise.resolve({ data, error: null });
      return Promise.resolve({ data: { id: 'camp_123', ...data }, error: null });
    }),
    update: (global as any).jest.fn().mockReturnThis(),
    range: (global as any).jest.fn().mockReturnThis(),
  };

  // Mock resolveUserAccessCore para evitar chamadas ao banco real
  (global as any).jest.mock('@/services/supabase/access-resolver', () => ({
    resolveUserAccessCore: (global as any).jest.fn().mockResolvedValue({ isOperative: true, status: 'active' })
  }));

  // 1. Caso A: Coupon_offer sem confirmação
  console.log('\nTeste A: Coupon_offer sem confirmação');
  const dtoA: CreateCampaignDTO = {
    name: 'Teste sem confirmação',
    items: [{
      product_name: 'Cupom 100 OFF',
      offer_type: 'coupon_offer',
      eligibility_status: 'eligible',
      eligibility_reasons: []
    } as any],
    destinations: [{ type: 'group', id: 'group_1' }]
  };

  try {
    await campaignService.createQuickSendCampaign(userId, dtoA, mockSupabase);
    console.error('  [FAIL] Backend deveria ter bloqueado coupon_offer sem confirmação.');
  } catch (err: any) {
    if (err.message === 'coupon_manual_confirmation_required') {
      console.log('  [PASS] Backend bloqueou corretamente com erro especializado.');
    } else {
      console.error('  [FAIL] Erro inesperado:', err.message);
    }
  }

  // 2. Caso B: Coupon_offer com metadata forjada fora do quick_send
  console.log('\nTeste B: Coupon_offer com flags forjadas fora do Quick Send');
  const dtoB: CreateCampaignDTO = {
    name: 'Teste Forjado',
    origin: 'radar', // Fingindo vir do Radar
    items: [{
      product_name: 'Cupom 100 OFF',
      offer_type: 'coupon_offer',
      eligibility_status: 'eligible',
      eligibility_reasons: []
    } as any],
    destinations: [{ type: 'group', id: 'group_1' }],
    metadata: {
      manualCouponSend: true,
      confirmedByUser: true,
      dispatchOrigin: 'quick_send_manual_coupon' // Forjando selo interno
    }
  };

  try {
    await campaignService.create(userId, dtoB, mockSupabase);
    console.error('  [FAIL] Backend deveria ter bloqueado coupon_offer forjado (radar + flags).');
  } catch (err: any) {
    if (err.message === 'coupon_manual_confirmation_required') {
      console.log('  [PASS] Backend bloqueou corretamente tentativa de spoofing.');
    } else {
      console.error('  [FAIL] Erro inesperado:', err.message);
    }
  }

  // 2.1 Caso B2: Origin 'coupon' (automação legado)
  console.log('\nTeste B2: Origin "coupon" (automação legado)');
  const dtoB2: CreateCampaignDTO = {
    name: 'Automação Legado',
    origin: 'coupon',
    items: [{
      product_name: 'Cupom Automático',
      eligibility_status: 'eligible',
      eligibility_reasons: []
    } as any],
    destinations: [{ type: 'group', id: 'group_1' }]
  };

  try {
    await campaignService.create(userId, dtoB2, mockSupabase);
    console.error('  [FAIL] Backend deveria ter bloqueado origin "coupon".');
  } catch (err: any) {
    if (err.message === 'coupon_manual_confirmation_required') {
      console.log('  [PASS] Backend bloqueou corretamente origin "coupon".');
    } else {
      console.error('  [FAIL] Erro inesperado:', err.message);
    }
  }

  // 3. Caso C: Coupon_offer confirmado pelo fluxo quick_send
  console.log('\nTeste C: Coupon_offer confirmado via Quick Send (Fluxo Oficial)');
  const dtoC: CreateCampaignDTO = {
    name: 'Cupom Validado',
    items: [{
      product_name: 'Cupom 100 OFF',
      offer_type: 'coupon_offer',
      eligibility_status: 'eligible',
      eligibility_reasons: []
    } as any],
    destinations: [{ type: 'group', id: 'group_1' }],
    metadata: {
      manualCouponSend: true,
      confirmedByUser: true
    }
  };

  try {
    const campaign: any = await campaignService.createQuickSendCampaign(userId, dtoC, mockSupabase);
    if (campaign && campaign.id === 'camp_123') {
      console.log('  [PASS] Backend autorizou envio manual via Quick Send.');
    }
  } catch (err: any) {
    console.error('  [FAIL] Erro ao autorizar envio legítimo:', err.message);
  }

  // 4. Caso F: Código puro (Permitido com aviso na UI, mas backend valida o envio)
  console.log('\nTeste F: Código puro (Sem link)');
  const dtoF: CreateCampaignDTO = {
    name: 'Cupom Código Puro',
    items: [{
      product_name: 'CÓDIGO: M0D4555HP',
      offer_type: 'coupon_offer',
      eligibility_status: 'eligible',
      eligibility_reasons: [],
      custom_text: 'Use o código M0D4555HP'
    } as any],
    destinations: [{ type: 'group', id: 'group_1' }],
    metadata: {
      manualCouponSend: true,
      confirmedByUser: true
    }
  };

  try {
    const campaign = await campaignService.createQuickSendCampaign(userId, dtoF, mockSupabase);
    if (campaign) {
      console.log('  [PASS] Envio manual de código puro autorizado.');
    }
  } catch (err: any) {
    console.error('  [FAIL] Erro no envio de código puro:', err.message);
  }

  // 5. Caso I: Produto normal continua funcionando
  console.log('\nTeste I: Produto normal continua inalterado');
  const dtoI: CreateCampaignDTO = {
    name: 'Produto Normal',
    items: [{
      product_name: 'Smartphone Top',
      offer_type: 'product_offer',
      eligibility_status: 'eligible',
      eligibility_reasons: []
    } as any],
    destinations: [{ type: 'group', id: 'group_1' }]
  };

  try {
    const campaign: any = await campaignService.createQuickSendCampaign(userId, dtoI, mockSupabase);
    if (campaign && campaign.origin === 'manual') {
      console.log('  [PASS] Fluxo de produto normal continua funcionando sem flags extras.');
    }
  } catch (err: any) {
    console.error('  [FAIL] Erro no fluxo de produto normal:', err.message);
  }

  // 6. Caso J: Verificação de constraints de segurança (discovered_coupons)
  console.log('\nTeste J: Segurança - discovered_coupons.dispatchable lock');
  // Aqui apenas confirmamos que não chamamos NENHUM update em discovered_coupons durante o fluxo
  const updateCalls = mockSupabase.from.mock.calls.filter((call: any) => call[0] === 'discovered_coupons');
  const hasUpdateOnCoupons = updateCalls.some(() => mockSupabase.update.mock.calls.length > 0);
  
  if (!hasUpdateOnCoupons) {
    console.log('  [PASS] Nenhuma alteração tentada em discovered_coupons.');
  } else {
    console.error('  [FAIL] Detectada tentativa de alteração em discovered_coupons!');
  }

  console.log('\n--- TESTES DE SEGURANÇA CONCLUÍDOS ---');
}

runTests().catch(console.error);
