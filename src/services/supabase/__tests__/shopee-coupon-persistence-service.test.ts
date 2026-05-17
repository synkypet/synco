import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { shopeeCouponPersistenceService } from '../shopee-coupon-persistence-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEST_USER_ID = '14ad671c-0477-436d-8de6-033a35cd86a8';

async function runTests() {
  console.log('🚀 Testes de Persistência de Cupons Shopee...\n');

  // Teste 1: Salvar cupom verificado
  console.log('[Teste 1] Salvar cupom verificado com afiliação');
  const result = await shopeeCouponPersistenceService.saveVerifiedShopeeCouponForUser({
    userId: TEST_USER_ID,
    contentType: 'verified_coupon',
    acceptedTarget: 'coupons',
    couponCode: 'TESTUNIT' + Math.floor(Math.random() * 1000),
    originalUrl: 'https://s.shopee.com.br/8V5pFHXaKo'
  }, supabase);

  console.log(`   ID: ${result.id}`);
  console.log(`   Afiliado: ${result.reaffiliated}`);

  // Teste 2: Duplicado (deve retornar o mesmo ID e atualizar)
  console.log('\n[Teste 2] Tratamento de Duplicados');
  const dupeResult = await shopeeCouponPersistenceService.saveVerifiedShopeeCouponForUser({
    userId: TEST_USER_ID,
    contentType: 'verified_coupon',
    acceptedTarget: 'coupons',
    couponCode: 'DUPE_TEST',
    originalUrl: 'https://s.shopee.com.br/8V5pFHXaKo'
  }, supabase);
  
  const dupeResult2 = await shopeeCouponPersistenceService.saveVerifiedShopeeCouponForUser({
    userId: TEST_USER_ID,
    contentType: 'verified_coupon',
    acceptedTarget: 'coupons',
    couponCode: 'DUPE_TEST',
    originalUrl: 'https://s.shopee.com.br/8V5pFHXaKo'
  }, supabase);

  console.log(`   IDs iguais? ${dupeResult.id === dupeResult2.id ? '✅' : '❌'}`);

  console.log('\n✅ Fim dos testes de persistência.');
}

runTests().catch(err => {
  console.error('❌ Erro nos testes:', err);
  process.exit(1);
});
