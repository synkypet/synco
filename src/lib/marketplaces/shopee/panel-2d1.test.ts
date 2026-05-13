
import { shopeeCouponService } from '../../../services/supabase/shopee-coupon-service';

/**
 * MOCK de Supabase para testes de painel
 */
const createMockSupabase = (rows: any[] = []) => {
  const queryBuilder: any = {
    from: () => queryBuilder,
    select: () => queryBuilder,
    eq: () => queryBuilder,
    order: () => queryBuilder,
    limit: () => queryBuilder,
    or: () => queryBuilder,
    then: (resolve: any) => resolve({ data: rows, error: null }),
    // Suporte para await query
    catch: () => queryBuilder
  };
  
  // Mock do objeto retornado pelo query
  const mockQuery = {
    data: rows,
    error: null
  };
  
  // Sobrescrevendo para retornar o mockQuery quando o query for awaitado
  queryBuilder.then = (onfulfilled: any) => Promise.resolve(onfulfilled(mockQuery));

  return queryBuilder;
};

async function testPanelLogic() {
  console.log('--- INICIANDO TESTES DO PAINEL DE CUPONS (FASE 2D.1.1) ---');

  const userId = 'user_123';

  // 1. Teste de Listagem (Serviço)
  console.log('\nTeste 1: Listagem básica do serviço');
  const mockDb = createMockSupabase([{ id: 'c1', code: 'PROMO10' }]);
  
  try {
    const results = await shopeeCouponService.listDiscoveredCoupons(userId, { limit: 10 }, mockDb as any);
    if (results && results.length === 1 && results[0].code === 'PROMO10') {
      console.log('  [PASS] Serviço retornou dados filtrados corretamente.');
    } else {
      console.log('  [FAIL] Falha no retorno do serviço.');
    }
  } catch (err) {
    console.log('  [FAIL] Erro na listagem:', err);
  }

  // 2. Teste de Isolamento (Simulado)
  console.log('\nTeste 2: Validação de filtros de segurança (userId)');
  let capturedUserId = '';
  const captureMock: any = {
    from: () => captureMock,
    select: () => captureMock,
    eq: (col: string, val: any) => {
      if (col === 'user_id') capturedUserId = val;
      return captureMock;
    },
    order: () => captureMock,
    limit: () => captureMock,
    then: (res: any) => res({ data: [], error: null })
  };

  await shopeeCouponService.listDiscoveredCoupons('target_user_456', {}, captureMock as any);
  if (capturedUserId === 'target_user_456') {
    console.log('  [PASS] Filtro de user_id aplicado obrigatoriamente.');
  } else {
    console.log('  [FAIL] Filtro de user_id NÃO aplicado ou incorreto.');
  }

  // 3. Teste de Limites
  console.log('\nTeste 3: Validação de limite máximo');
  let capturedLimit = 0;
  const limitMock: any = {
    from: () => limitMock,
    select: () => limitMock,
    eq: () => limitMock,
    order: () => limitMock,
    limit: (val: number) => {
      capturedLimit = val;
      return limitMock;
    },
    then: (res: any) => res({ data: [], error: null })
  };

  await shopeeCouponService.listDiscoveredCoupons(userId, { limit: 500 }, limitMock as any);
  if (capturedLimit === 100) {
    console.log('  [PASS] Limite máximo de 100 respeitado (mesmo pedindo 500).');
  } else {
    console.log('  [FAIL] Limite máximo NÃO respeitado. Capturado:', capturedLimit);
  }

  console.log('\n--- TESTES DO PAINEL CONCLUÍDOS ---');
}

testPanelLogic().catch(console.error);
