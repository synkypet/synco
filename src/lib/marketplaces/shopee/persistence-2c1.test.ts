
import { shopeeCouponService } from '@/services/supabase/shopee-coupon-service';
import { extractShopeeCoupons } from './coupon-extractor';
import { ShopeeCoupon } from '@/types/shopee-coupon';

// Mock simples para o Supabase
const createMockSupabase = () => {
  const dataStore: any[] = [];
  
  return {
    from: (table: string) => ({
      upsert: (payload: any, options: any) => {
        // Simulação de constraints da Migration FASE 2C.1.1
        if (payload.dispatchable === true) throw new Error('CHECK constraint violation: dispatchable must be false');
        if (payload.auto_dispatch_blocked === false) throw new Error('CHECK constraint violation: auto_dispatch_blocked must be true');
        if (!payload.dedupe_key || payload.dedupe_key.trim() === '') throw new Error('CHECK constraint violation: dedupe_key required');
        
        const existingIndex = dataStore.findIndex(
          item => item.user_id === payload.user_id && item.dedupe_key === payload.dedupe_key
        );
        
        if (existingIndex > -1) {
          dataStore[existingIndex] = {
            ...dataStore[existingIndex],
            ...payload,
            capture_count: (dataStore[existingIndex].capture_count || 1) + 1,
            last_seen_at: new Date().toISOString()
          };
        } else {
          dataStore.push({ ...payload, id: 'mock-uuid', capture_count: 1, captured_at: new Date().toISOString() });
        }
        
        return {
          select: () => ({
            single: () => ({ data: dataStore[dataStore.length - 1], error: null })
          })
        };
      },
      update: (updates: any) => ({
        match: (filter: any) => {
          const item = dataStore.find(i => i.user_id === filter.user_id && i.dedupe_key === filter.dedupe_key);
          if (item) Object.assign(item, updates);
          return { data: item, error: null };
        }
      })
    }),
    _store: dataStore
  };
};

async function runPersistenceTest() {
  console.log('--- INICIANDO TESTES DE PERSISTÊNCIA FASE 2C.1.1 (HARDENING) ---\n');
  const mockSupabase = createMockSupabase() as any;
  const userId = 'user-123';

  console.log('Cenário 1: Salvar cupom por código (Válido)');
  const coupons1 = extractShopeeCoupons('🎟️Use o cupom: M0D4555HP');
  await shopeeCouponService.persistCandidate(userId, coupons1[0], { rawText: '...' }, mockSupabase);
  
  const saved1 = mockSupabase._store[0];
  if (saved1.code === 'M0D4555HP' && saved1.dispatchable === false) {
    console.log('  [PASS] Cupom persistido corretamente.');
  } else {
    console.error('  [FAIL] Falha na persistência.');
    process.exit(1);
  }

  console.log('\nCenário 2: Rejeitar código vazio');
  const invalidCoupon1: any = { type: 'codigo', code: '', marketplace: 'shopee' };
  const res2 = await shopeeCouponService.persistCandidate(userId, invalidCoupon1, {}, mockSupabase);
  if (res2 === null && mockSupabase._store.length === 1) {
    console.log('  [PASS] Rejeição de código vazio confirmada.');
  } else {
    console.error('  [FAIL] Serviço aceitou código vazio!');
    process.exit(1);
  }

  console.log('\nCenário 3: Rejeitar link_resgate sem URL');
  const invalidCoupon2: any = { type: 'link_resgate', redemptionUrl: '', marketplace: 'shopee' };
  const res3 = await shopeeCouponService.persistCandidate(userId, invalidCoupon2, {}, mockSupabase);
  if (res3 === null && mockSupabase._store.length === 1) {
    console.log('  [PASS] Rejeição de link sem URL confirmada.');
  } else {
    console.error('  [FAIL] Serviço aceitou link sem URL!');
    process.exit(1);
  }

  console.log('\nCenário 4: Forçar Trava de Segurança (Mesmo que input seja true)');
  const forcedCoupon: any = { ...coupons1[0], dispatchable: true }; 
  await shopeeCouponService.persistCandidate(userId, forcedCoupon, {}, mockSupabase);
  const saved4 = mockSupabase._store[0]; // Upsert no primeiro
  if (saved4.dispatchable === false) {
    console.log('  [PASS] Trava de segurança forçada pelo serviço (Ignorou input maligno).');
  } else {
    console.error('  [FAIL] Serviço permitiu alteração de dispatchable!');
    process.exit(1);
  }

  console.log('\nCenário 5: Verificação de Constraints de Migration (Mock)');
  try {
     // Tentativa direta no mock simulando bypass do serviço
     mockSupabase.from('discovered_coupons').upsert({ user_id: userId, dedupe_key: 'test', dispatchable: true }, {});
     console.error('  [FAIL] Mock permitiu dispatchable true!');
     process.exit(1);
  } catch (e: any) {
     if (e.message.includes('CHECK constraint violation')) {
       console.log('  [PASS] Constraint de DB simulada bloqueou dispatchable true.');
     } else {
       throw e;
     }
  }

  console.log('\nCenário 6: Deduplicação e Contador');
  await shopeeCouponService.persistCandidate(userId, coupons1[0], {}, mockSupabase);
  if (mockSupabase._store.length === 1 && mockSupabase._store[0].capture_count >= 2) {
    console.log('  [PASS] Deduplicação e contagem de captura funcionando.');
  } else {
    console.error('  [FAIL] Falha no contador de dedupe.');
    process.exit(1);
  }

  console.log('\n--- TESTES DE HARDENING CONCLUÍDOS COM SUCESSO ---');
}

runPersistenceTest().catch(console.error);
