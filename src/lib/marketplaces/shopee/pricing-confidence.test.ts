
import { generatePricingInsight, formatSmartMessage } from './pricing-logic';
import { FactualData } from '../../linkProcessor';

async function runTests() {
  console.log('--- [PRICING-CONFIDENCE-TEST] INICIANDO ---');

  const baseFactual: FactualData = {
    originalUrl: 'https://shopee.com.br/product/1/2',
    cleanUrl: 'https://shopee.com.br/product/1/2',
    marketplace: 'Shopee',
    title: 'Penteadeira de quarto Luxo',
    finalLinkToSend: 'https://s.shopee.com.br/affiliate',
    fetchedAt: new Date().toISOString(),
    incoming_url: 'https://shopee.com.br/product/1/2',
    canonical_url: 'https://shopee.com.br/product/1/2',
    reaffiliation_status: 'success',
    eligibility: { isEligible: true, status: 'eligible', reasons: [], offer_type: 'product_offer' },
    pixDisplayEligible: false
  };

  // --- CENÁRIO 1: Preço factual da API ---
  console.log('\n[CENÁRIO 1] Preço factual da API');
  const s1 = generatePricingInsight({
    ...baseFactual,
    price: 617,
    originalPrice: 630,
    currentPriceSource: 'api.priceMin'
  });
  console.log(`  CurrentPrice Source: ${s1.currentPrice.source} (Esperado: factual_api)`);
  console.log(`  CanDisplay: De/Por (Esperado: true)`);
  console.log(`  Message Sample: \n${formatSmartMessage(s1, 'http://link')}\n`);

  // --- CENÁRIO 2: Pix heurístico ---
  console.log('[CENÁRIO 2] Pix heurístico');
  const s2 = generatePricingInsight({
    ...baseFactual,
    price: 617,
    estimatedPixPrice: 567.64,
    estimatedPixSource: 'heuristic.pix_0_92',
    currentPriceSource: 'api.priceMin'
  });
  console.log(`  Pix Source: ${s2.pixPrice.source} (Esperado: estimated)`);
  console.log(`  CanDisplayPix: ${s2.canDisplayPix} (Esperado: false)`);
  console.assert(s2.canDisplayPix === false, 'Pix heurístico não deve ser exibível');

  // --- CENÁRIO 3: Parcelamento heurístico ---
  console.log('[CENÁRIO 3] Parcelamento heurístico');
  const s3 = generatePricingInsight({
    ...baseFactual,
    price: 617,
    installments: '3x de R$ 205,66',
    currentPriceSource: 'api.priceMin'
  });
  console.log(`  Installment Source: ${s3.installmentCount.source} (Esperado: estimated)`);
  console.log(`  CanDisplayInstallments: ${s3.canDisplayInstallments} (Esperado: false)`);
  console.assert(s3.canDisplayInstallments === false, 'Parcelamento heurístico não deve ser exibível');

  // --- CENÁRIO 4: Cupom validado ---
  console.log('[CENÁRIO 4] Cupom validado');
  const s4 = generatePricingInsight({
    ...baseFactual,
    price: 617,
    currentPriceSource: 'api.priceMin',
    coupons: [
      {
        marketplace: 'shopee',
        type: 'link_resgate',
        code: null,
        couponLabel: 'R$ 30 OFF em TODAS AS LOJAS',
        redemptionUrl: 'http://coupon',
        confidence: 0.9,
        status: 'candidate',
        dedupeKey: 'k1'
      }
    ]
  }, '🛍️ Penteadeira: cupom de R$ 30 OFF acima de R$ 299');
  console.log(`  AdjustedPrice: ${s4.couponAdjustedPrice.value} (Esperado: 587)`);
  console.log(`  Source: ${s4.couponAdjustedPrice.source} (Esperado: calculated_verified)`);
  console.log(`  CanDisplayCouponPrice: ${s4.canDisplayCouponPrice} (Esperado: true)`);
  console.log(`  Message Sample: \n${formatSmartMessage(s4, 'http://link', 'http://coupon')}\n`);

  // --- CENÁRIO 5: Cupom abaixo do mínimo ---
  console.log('[CENÁRIO 5] Cupom abaixo do mínimo');
  const s5 = generatePricingInsight({
    ...baseFactual,
    price: 250,
    currentPriceSource: 'api.priceMin',
    coupons: [
      {
        marketplace: 'shopee',
        type: 'link_resgate',
        code: null,
        couponLabel: 'R$ 30 OFF',
        redemptionUrl: 'http://coupon',
        confidence: 0.9,
        status: 'candidate',
        dedupeKey: 'k2'
      }
    ]
  }, '🛍️ Penteadeira: cupom de R$ 30 OFF acima de R$ 299');
  console.log(`  CanDisplayCouponPrice: ${s5.canDisplayCouponPrice} (Esperado: false)`);
  console.log(`  Warnings: ${JSON.stringify(s5.warnings)} (Esperado: contains coupon_min_spend_not_met)`);

  // --- CENÁRIO 6: Cupom sem valor claro ---
  console.log('[CENÁRIO 6] Cupom sem valor claro');
  const s6 = generatePricingInsight({
    ...baseFactual,
    price: 617,
    currentPriceSource: 'api.priceMin',
    coupons: [
      {
        marketplace: 'shopee',
        type: 'pagina_cupons',
        code: null,
        couponLabel: 'Cupom especial',
        redemptionUrl: 'http://coupon',
        confidence: 0.8,
        status: 'candidate',
        dedupeKey: 'k3'
      }
    ]
  });
  console.log(`  CanDisplayCouponPrice: ${s6.canDisplayCouponPrice} (Esperado: false)`);

  // --- CENÁRIO 7: Parcelamento factual de texto ---
  console.log('[CENÁRIO 7] Parcelamento factual de texto');
  const s7 = generatePricingInsight({
    ...baseFactual,
    price: 1066.99,
    currentPriceSource: 'api.priceMin'
  }, '🛍️ Penteadeira: compre em 12x de R$ 88,91 sem juros');
  console.log(`  InstallmentCount: ${s7.installmentCount.value} (Esperado: 12)`);
  console.log(`  NoInterest: ${s7.installmentNoInterest} (Esperado: true)`);
  console.log(`  CanDisplayInstallments: ${s7.canDisplayInstallments} (Esperado: true)`);
  console.log(`  Message Sample: \n${formatSmartMessage(s7, 'http://link')}\n`);

  // --- CENÁRIO 8: Pix factual de texto ---
  console.log('[CENÁRIO 8] Pix factual de texto');
  const s8 = generatePricingInsight({
    ...baseFactual,
    price: 537.64,
    currentPriceSource: 'api.priceMin'
  }, '🛍️ Penteadeira: Apenas R$ 537,64 no pix hoje');
  console.log(`  PixPrice: ${s8.pixPrice.value} (Esperado: 537.64)`);
  console.log(`  Source: ${s8.pixPrice.source} (Esperado: factual_text)`);
  console.log(`  CanDisplayPix: ${s8.canDisplayPix} (Esperado: true)`);

  // --- CENÁRIO 9: Dados inconsistentes (Original < Current) ---
  console.log('[CENÁRIO 9] Dados inconsistentes (Original < Current)');
  const s9 = generatePricingInsight({
    ...baseFactual,
    price: 617,
    originalPrice: 500,
    currentPriceSource: 'api.priceMin'
  });
  console.log(`  OriginalPrice Value: ${s9.originalPrice.value} (Esperado: null)`);
  console.log(`  Warnings: ${JSON.stringify(s9.originalPrice.warnings)} (Esperado: contains original_price_inconsistent)`);

  // --- CENÁRIO 10: Formatter de simulação (Mistura de fatos e estimativas) ---
  console.log('[CENÁRIO 10] Formatter de simulação (Mistura de fatos e estimativas)');
  const s10 = generatePricingInsight({
    ...baseFactual,
    price: 1066.99,
    originalPrice: 1200,
    estimatedPixPrice: 981.63,
    estimatedPixSource: 'heuristic.pix_0_92',
    currentPriceSource: 'api.priceMin'
  }, '🛍️ Penteadeira: 12x de R$ 88,91 sem juros');
  
  const msg10 = formatSmartMessage(s10, 'http://affiliate');
  console.log(`  Message Preview: \n${msg10}\n`);
  console.assert(!msg10.includes('NO PIX'), 'Não deve mostrar NO PIX pois é estimado');
  console.assert(msg10.includes('12x'), 'Deve mostrar 12x pois veio do texto (factual_text)');

  // --- CENÁRIO 11: Preço Original derivado de Desconto (calculated_verified) ---
  console.log('[CENÁRIO 11] Preço Original derivado de Desconto');
  const s11 = generatePricingInsight({
    ...baseFactual,
    price: 29.88,
    discountPercent: 10,
    currentPriceSource: 'api.priceMin'
  });
  console.log(`  Derived OriginalPrice: ${s11.originalPrice.value} (Esperado: 33.2)`);
  console.log(`  Source: ${s11.originalPrice.source} (Esperado: calculated_verified)`);
  console.assert(s11.originalPrice.value === 33.2, 'Deve calcular preço original de 10%');

  // --- CENÁRIO 12: Prioridade Factual API sobre Desconto ---
  console.log('[CENÁRIO 12] Prioridade Factual API sobre Desconto');
  const s12 = generatePricingInsight({
    ...baseFactual,
    price: 51.99,
    originalPrice: 58.50,
    discountPercent: 11,
    currentPriceSource: 'api.priceMin'
  });
  console.log(`  OriginalPrice: ${s12.originalPrice.value} (Esperado: 58.50)`);
  console.log(`  Source: ${s12.originalPrice.source} (Esperado: factual_api)`);
  console.assert(s12.originalPrice.value === 58.50, 'Deve priorizar valor factual da API');

  // --- CENÁRIO 13: Rejeição de Desconto Absurdo (> 98%) ---
  console.log('[CENÁRIO 13] Rejeição de Desconto Absurdo (> 98%)');
  const s13 = generatePricingInsight({
    ...baseFactual,
    price: 100,
    discountPercent: 99,
    currentPriceSource: 'api.priceMin'
  });
  console.log(`  OriginalPrice: ${s13.originalPrice.value} (Esperado: null)`);
  console.assert(s13.originalPrice.value === null, 'Deve rejeitar percentual absurdo');

  console.log('\n--- [PRICING-CONFIDENCE-TEST] CONCLUÍDO ---');
}

runTests().catch(e => {
  console.error('Falha crítica nos testes:', e);
  process.exit(1);
});
