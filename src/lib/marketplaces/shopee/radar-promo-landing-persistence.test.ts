import { processInboundAutomation } from '../../automation/processor';

// Mock Env Vars
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-key';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co';

/**
 * TESTE DE INTEGRAÇÃO: PERSISTÊNCIA E SEGURANÇA RADAR PROMO (FASE 2G.1A)
 */
async function testRadarPromoLandingPersistence() {
  console.log('--- [RADAR-PROMO-TEST] INICIANDO VALIDAÇÃO ---');

  const mockUserId = '00000000-0000-0000-0000-000000000001';
  const mockSource = { id: '00000000-0000-0000-0000-000000000002', user_id: mockUserId, name: 'Grupo Teste', source_type: 'group_monitor', is_active: true };
  const mockRoute = { id: '00000000-0000-0000-0000-000000000003', target_type: 'whatsapp', target_id: '123', is_active: true };
  const mockConn = { 
    id: 'conn-1', 
    user_id: mockUserId,
    marketplace_name: 'shopee', 
    shopee_app_id: '123', 
    shopee_app_secret: '456',
    is_active: true
  };

  // 1. Mocks de Captura de Banco (Chainable Mock)
  const dbCalls: any[] = [];
  
  function createChainableMock(table: string, data: any) {
    const mock: any = {
      data,
      error: null,
      select: () => mock,
      eq: () => mock,
      in: () => mock,
      order: () => mock,
      limit: () => mock,
      not: () => mock,
      lt: () => mock,
      gt: () => mock,
      maybeSingle: () => Promise.resolve({ data, error: null }),
      single: () => Promise.resolve({ data: Array.isArray(data) ? data[0] : data, error: null }),
      then: (onfulfilled: any) => Promise.resolve({ data, error: null }).then(onfulfilled)
    };
    return mock;
  }

  const mockSupabase = {
    from: (table: string) => {
      let resultData: any = [];
      if (table === 'automation_sources') resultData = mockSource;
      if (table === 'automation_routes') resultData = [mockRoute];
      if (table === 'channels') resultData = { config: { wasender_status: 'connected' } };
      if (table === 'marketplace_connections') resultData = [mockConn];
      if (table === 'groups') resultData = [{ id: '123', remote_id: 'remote-1' }];
      if (table === 'products') resultData = { id: 'prod-1' };

      const chain = createChainableMock(table, resultData);
      
      chain.insert = (payload: any) => {
        dbCalls.push({ type: 'insert', table, payload: Array.isArray(payload) ? payload[0] : payload });
        return createChainableMock(table, { id: 'new-id', ...(Array.isArray(payload) ? payload[0] : payload) });
      };
      chain.update = (payload: any) => {
        dbCalls.push({ type: 'update', table, payload });
        return createChainableMock(table, payload);
      };
      chain.upsert = (payload: any) => {
        dbCalls.push({ type: 'upsert', table, payload });
        return createChainableMock(table, payload);
      };
      chain.delete = () => createChainableMock(table, null);

      return chain;
    }
  } as any;

  // 2. Mock do Fetch Global
  const originalFetch = global.fetch;
  global.fetch = (async (url: string) => {
    const urlStr = String(url);
    if (urlStr.includes('super-ofertas')) {
       return {
         status: 200, ok: true,
         text: async () => '<html>Promo</html>',
         json: async () => ({ data: { generateShortLink: { shortLink: 'https://shopee.com.br/reaffiliated' } } }),
         headers: new Headers({ 'content-type': 'application/json' })
       };
    }
    if (urlStr.includes('product')) {
       return {
         status: 200, ok: true,
         text: async () => '<html><meta property="og:title" content="Produto Shopee"></html>',
         json: async () => ({ data: { generateShortLink: { shortLink: 'https://shopee.com.br/reaffiliated' } } }),
         headers: new Headers({ 'content-type': 'application/json' })
       };
    }
    return {
      status: 200, ok: true,
      text: async () => '[]',
      json: async () => ([]),
      headers: new Headers({ 'content-type': 'application/json' })
    };
  }) as any;

  try {
    // --- CENÁRIO A: Captura de /m/super-ofertas ---
    console.log('\n>>> CENÁRIO A: Captura de /m/super-ofertas');
    const bodyA = 'https://shopee.com.br/m/super-ofertas';
    const payloadA = { userId: mockUserId, body: bodyA, messageId: 'msg-a', externalGroupId: 'grp-1', channelId: 'ch-1', isFromMe: false };
    
    await processInboundAutomation(payloadA, mockSupabase);

    const promoPersist = dbCalls.find(c => c.type === 'insert' && c.table === 'discovered_promo_pages');
    if (promoPersist) {
      console.log('✅ SUCESSO: Persistido em discovered_promo_pages');
    } else {
      console.error('❌ FALHA: Promo landing não persistida');
    }

    const hasCampaign = dbCalls.some(c => c.table === 'campaigns');
    if (!hasCampaign) {
      console.log('✅ SUCESSO: Nenhuma campanha gerada (SAFE-SKIP ok)');
    } else {
      console.error('❌ FALHA: Gerou campanha indevida para promo_landing');
    }

    // --- CENÁRIO B: Produto + Super Ofertas ---
    console.log('\n>>> CENÁRIO B: Produto + Super Ofertas');
    dbCalls.length = 0;
    const bodyB = 'Produto: https://shopee.com.br/product/123/456 e Promo: https://shopee.com.br/m/super-ofertas';
    const payloadB = { ...payloadA, body: bodyB, messageId: 'msg-b' };
    
    await processInboundAutomation(payloadB, mockSupabase);

    const hasProductCampaign = dbCalls.some(c => c.table === 'campaigns');
    const hasPromoPersistB = dbCalls.some(c => c.type === 'insert' && c.table === 'discovered_promo_pages');

    if (hasProductCampaign && hasPromoPersistB) {
       console.log('✅ SUCESSO: Produto disparado, Promo apenas persistida');
    } else {
       console.error(`❌ FALHA: Comportamento misto incorreto. Campanha: ${hasProductCampaign}, Promo: ${hasPromoPersistB}`);
    }

  } catch (err: any) {
    console.error('❌ ERRO CRÍTICO NO TESTE:', err.message);
    process.exit(1);
  } finally {
    global.fetch = originalFetch;
  }

  console.log('\n--- [RADAR-PROMO-TEST] CONCLUÍDO ---');
}

testRadarPromoLandingPersistence().catch(console.error);
