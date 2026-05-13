
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
    fn.mockResolvedValue = (val: any) => {
      impl = () => Promise.resolve(val);
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
  console.log('--- INICIANDO TESTES DE SEGURANÇA E ENVIO MANUAL DE CUPONS (BUGFIX 2E.1B) ---');

  const userId = 'user_123';
  
  // Rastreamento de inserções de jobs
  let jobsInserted: any[] = [];

  // Factory para criar uma chain de Supabase mockada
  const createMockChain = (data: any = null, error: any = null) => {
    const chain: any = {
      select: (global as any).jest.fn().mockReturnThis(),
      eq: (global as any).jest.fn().mockReturnThis(),
      in: (global as any).jest.fn().mockReturnThis(),
      order: (global as any).jest.fn().mockReturnThis(),
      limit: (global as any).jest.fn().mockReturnThis(),
      single: (global as any).jest.fn().mockImplementation(() => Promise.resolve({ data: Array.isArray(data) ? data[0] : data, error })),
      then: (resolve: any) => resolve({ data, error }),
      catch: (reject: any) => reject(error),
      insert: (global as any).jest.fn().mockImplementation((d: any) => {
         if (d && d.campaign_id) return Promise.resolve({ data: d, error: null });
         return Promise.resolve({ data: { id: 'some_id', ...d }, error: null });
      }),
      upsert: (global as any).jest.fn().mockImplementation((d: any) => {
         jobsInserted = jobsInserted.concat(Array.isArray(d) ? d : [d]);
         return Promise.resolve({ data: d, error: null });
      }),
      update: (global as any).jest.fn().mockReturnThis()
    };
    return chain;
  };

  const mockGroups = [
    { 
      remote_id: 'group_A', 
      name: 'Grupo A', 
      channel_id: 'ch_1', 
      channels: { 
        config: { sessionId: 'sid_1', status: 'connected' }, 
        type: 'whatsapp' 
      } 
    }
  ];

  const mockSupabase: any = {
    from: (global as any).jest.fn().mockImplementation((table: string) => {
      if (table === 'groups') return createMockChain(mockGroups);
      if (table === 'channels') return createMockChain([{ id: 'ch_1', type: 'whatsapp', config: { sessionId: 'sid_1', status: 'connected' } }]);
      if (table === 'campaigns') return createMockChain({ id: 'camp_123', status: 'pending' });
      if (table === 'campaign_items') return createMockChain([{ id: 'item_0', product_name: 'Item' }]);
      if (table === 'access_control') return createMockChain({ is_operative: true, status: 'active' });
      return createMockChain([]);
    })
  };

  // Mock resolveUserAccessCore
  (global as any).jest.mock('@/services/supabase/access-resolver', () => ({
    resolveUserAccessCore: (global as any).jest.fn().mockResolvedValue({ isOperative: true, status: 'active' })
  }));

  // 1. Caso C: Coupon_offer confirmado via Quick Send (DEVE GERAR JOBS AGORA)
  console.log('\nTeste C: Coupon_offer confirmado via Quick Send -> Deve gerar Send Jobs');
  jobsInserted = [];
  const dtoC: CreateCampaignDTO = {
    name: 'Cupom Manual',
    items: [{
      product_name: 'Cupom 100 OFF',
      offer_type: 'coupon_offer',
      eligibility_status: 'eligible',
      eligibility_reasons: []
    } as any],
    destinations: [{ type: 'group', id: 'group_A' }],
    metadata: {
      manualCouponSend: true,
      confirmedByUser: true,
      dispatchOrigin: 'quick_send_manual_coupon'
    }
  };

  try {
    const campaign: any = await campaignService.createQuickSendCampaign(userId, dtoC, mockSupabase);
    if (campaign && campaign.status !== 'failed' && jobsInserted.length > 0) {
      console.log(`  [PASS] Jobs gerados: ${jobsInserted.length}`);
      console.log(`  [PASS] Job destination: ${jobsInserted[0].destination}`);
    } else {
      console.error('  [FAIL] Backend autorizou campanha mas NÃO gerou jobs para o cupom.');
      if (campaign.status === 'failed') console.error('  [FAIL] Campanha marcada como failed.');
    }
  } catch (err: any) {
    console.error('  [FAIL] Erro inesperado:', err.message);
  }

  // 2. Caso B2: Origin 'coupon' (Radar/Automático) -> DEVE CONTINUAR BLOQUEADO
  console.log('\nTeste B2: Origin "coupon" (Radar/Automático) -> Deve ser bloqueado');
  const dtoB2: CreateCampaignDTO = {
    name: 'Cupom Automático',
    origin: 'coupon',
    items: [{
      product_name: 'Cupom 50 OFF',
      eligibility_status: 'eligible',
      eligibility_reasons: []
    } as any],
    destinations: [{ type: 'group', id: 'group_A' }]
  };

  try {
    await campaignService.create(userId, dtoB2, mockSupabase);
    console.error('  [FAIL] Backend deveria ter bloqueado origin "coupon".');
  } catch (err: any) {
    if (err.message === 'coupon_manual_confirmation_required') {
      console.log('  [PASS] Backend bloqueou origin "coupon" corretamente.');
    } else {
      console.error('  [FAIL] Erro inesperado:', err.message);
    }
  }

  console.log('\n--- TESTES DE BUGFIX CONCLUÍDOS ---');
}

runTests().catch(console.error);
