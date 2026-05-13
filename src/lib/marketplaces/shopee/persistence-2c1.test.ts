
import { shopeeCouponService } from '@/services/supabase/shopee-coupon-service';
import { extractShopeeCoupons } from './coupon-extractor';

// Mock simples para o Supabase
const createMockSupabase = () => {
  const dataStore: any[] = [];
  
  return {
    from: (table: string) => ({
      upsert: (payload: any, options: any) => {
        const existingIndex = dataStore.findIndex(
          item => item.user_id === payload.user_id && item.dedupe_key === payload.dedupe_key
        );
        
        if (existingIndex > -1) {
          // Simula incremento de capture_count e atualização de timestamps
          dataStore[existingIndex] = {
            ...dataStore[existingIndex],
            ...payload,
            capture_count: (dataStore[existingIndex].capture_count || 1) + 1,
            last_seen_at: new Date().toISOString()
          };
        } else {
          dataStore.push({ ...payload, id: 'mock-uuid', captured_at: new Date().toISOString() });
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
  console.log('--- INICIANDO TESTES DE PERSISTÊNCIA FASE 2C.1 ---\n');
  const mockSupabase = createMockSupabase() as any;
  const userId = 'user-123';

  console.log('Cenário 1: Salvar cupom por código');
  const coupons1 = extractShopeeCoupons('🎟️Use o cupom: M0D4555HP');
  await shopeeCouponService.persistCandidate(userId, coupons1[0], { rawText: '🎟️Use o cupom: M0D4555HP' }, mockSupabase);
  
  const saved1 = mockSupabase._store[0];
  if (saved1.code === 'M0D4555HP' && saved1.dedupe_key === 'shopee:coupon:code:M0D4555HP' && saved1.dispatchable === false) {
    console.log('  [PASS] Cupom de código persistido com trava de segurança.');
  } else {
    console.error('  [FAIL] Falha na persistência do código.', saved1);
    process.exit(1);
  }

  console.log('\nCenário 2: Salvar cupom por link de resgate');
  const coupons2 = extractShopeeCoupons('🎟️Use o cupom: R$50 OFF| resgate aqui: https://s.shopee.com.br/gMfczVZwO');
  await shopeeCouponService.persistCandidate(userId, coupons2[0], { rawText: '...' }, mockSupabase);
  
  const saved2 = mockSupabase._store[1];
  if (saved2.coupon_type === 'link_resgate' && saved2.dedupe_key.includes('shopee:coupon:url:')) {
    console.log('  [PASS] Cupom de link persistido com dedupe key de URL.');
  } else {
    console.error('  [FAIL] Falha na persistência do link.', saved2);
    process.exit(1);
  }

  console.log('\nCenário 3: Salvar página central');
  const coupons3 = extractShopeeCoupons('Confira os cupons Shopee: https://br.shp.ee/CKfvC8dB');
  await shopeeCouponService.persistCandidate(userId, coupons3[0], {}, mockSupabase);
  
  const saved3 = mockSupabase._store[2];
  if (saved3.coupon_type === 'pagina_cupons') {
    console.log('  [PASS] Página de cupons persistida.');
  } else {
    console.error('  [FAIL] Falha na persistência da página.', saved3);
    process.exit(1);
  }

  console.log('\nCenário 4: Deduplicação (Mesmo Cupom)');
  const originalCaptureCount = saved1.capture_count;
  await shopeeCouponService.persistCandidate(userId, coupons1[0], {}, mockSupabase);
  
  if (mockSupabase._store.length === 3 && mockSupabase._store[0].capture_count > originalCaptureCount) {
    console.log('  [PASS] Deduplicação funcionou. Contador incrementado.');
  } else {
    console.error('  [FAIL] Falha na deduplicação.', mockSupabase._store);
    process.exit(1);
  }

  console.log('\nCenário 5: Segurança (Trava Hard-coded)');
  const allSafe = mockSupabase._store.every((c: any) => 
    c.dispatchable === false && 
    c.auto_dispatch_blocked === true && 
    c.block_reason === 'coupon_requires_manual_review_or_phase_2c_dispatch'
  );
  if (allSafe) {
    console.log('  [PASS] Todos os cupons possuem trava de segurança ativa.');
  } else {
    console.error('  [FAIL] Falha na trava de segurança!');
    process.exit(1);
  }

  console.log('\n--- TESTES DE PERSISTÊNCIA CONCLUÍDOS COM SUCESSO ---');
}

runPersistenceTest().catch(console.error);
