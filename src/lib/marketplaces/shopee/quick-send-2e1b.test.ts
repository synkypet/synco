// Set dummy env vars BEFORE any imports
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

// Rastreamento de inserções de jobs
let jobsInserted: any[] = [];

// Factory para criar uma chain de Supabase mockada
const createMockChain = (data: any = null, error: any = null) => {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => chain,
    range: () => chain,
    single: () => Promise.resolve({ data: Array.isArray(data) ? data[0] : data, error }),
    then: (resolve: any) => resolve({ data, error }),
    catch: (reject: any) => reject(error),
    insert: (d: any) => ({
        select: () => ({
            single: () => Promise.resolve({ data: Array.isArray(d) ? { id: 'some_id', ...d[0] } : { id: 'some_id', ...d }, error: null }),
            then: (resolve: any) => resolve({ data: Array.isArray(d) ? d.map((x, i) => ({ id: `item_${i}`, ...x })) : [{ id: 'item_1', ...d }], error: null })
        }),
        then: (resolve: any) => resolve({ data: Array.isArray(d) ? d.map((x, i) => ({ id: `item_${i}`, ...x })) : [{ id: 'item_1', ...d }], error: null })
    }),
    upsert: (d: any) => {
        jobsInserted = jobsInserted.concat(Array.isArray(d) ? d : [d]);
        return Promise.resolve({ data: d, error: null });
    },
    update: () => chain
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
  from: (table: string) => {
    if (table === 'groups') return createMockChain(mockGroups);
    if (table === 'channels') return createMockChain([{ id: 'ch_1', type: 'whatsapp', config: { sessionId: 'sid_1', status: 'connected' } }]);
    if (table === 'campaigns') return createMockChain({ id: 'camp_123', status: 'pending' });
    if (table === 'campaign_items') return createMockChain([{ id: 'item_0', product_name: 'Item' }]);
    if (table === 'access_control') return createMockChain({ is_operative: true, status: 'active' });
    if (table === 'destination_list_groups') return createMockChain([]);
    return createMockChain([]);
  }
};

// Hijack Supabase Client
const clientPath = require.resolve('../../../lib/supabase/client');
delete require.cache[clientPath];
// @ts-ignore
require.cache[clientPath] = {
  id: clientPath,
  filename: clientPath,
  loaded: true,
  exports: {
    createClient: () => mockSupabase
  }
};

// Hijack Access Resolver
const resolverPath = require.resolve('../../../services/supabase/access-resolver');
delete require.cache[resolverPath];
// @ts-ignore
require.cache[resolverPath] = {
  id: resolverPath,
  filename: resolverPath,
  loaded: true,
  exports: {
    resolveUserAccessCore: async () => ({ isOperative: true, status: 'active', quotas: { monthly_send_limit: 10000 } })
  }
};

const { campaignService } = require('../../../services/supabase/campaign-service');

async function runTests() {
  console.log('--- INICIANDO TESTES DE SEGURANÇA E ENVIO MANUAL DE CUPONS (BUGFIX 2E.1B) ---');

  const userId = 'user_123';
  
  // 1. Caso C: Coupon_offer confirmado via Quick Send (DEVE GERAR JOBS AGORA)
  console.log('\nTeste C: Coupon_offer confirmado via Quick Send -> Deve gerar Send Jobs');
  jobsInserted = [];
  const dtoC = {
    name: 'Cupom Manual',
    items: [{
      product_name: 'Cupom 100 OFF',
      offer_type: 'coupon_offer',
      eligibility_status: 'eligible',
      eligibility_reasons: []
    }],
    destinations: [{ type: 'group', id: 'group_A' }],
    metadata: {
      manualCouponSend: true,
      confirmedByUser: true,
      dispatchOrigin: 'quick_send_manual_coupon'
    }
  };

  try {
    const campaign = await campaignService.createQuickSendCampaign(userId, dtoC, mockSupabase);
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
  const dtoB2 = {
    name: 'Cupom Automático',
    origin: 'coupon',
    items: [{
      product_name: 'Cupom 50 OFF',
      eligibility_status: 'eligible',
      eligibility_reasons: []
    }],
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
