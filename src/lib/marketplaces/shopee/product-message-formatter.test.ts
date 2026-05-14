
import { formatShopeeProductMessage } from './product-message-formatter';
import { FactualData } from '../../linkProcessor';

async function runTests() {
  console.log('--- [PRODUCT-MESSAGE-FORMATTER-TEST] INICIANDO ---');

  const baseFactual: FactualData = {
    originalUrl: 'https://shopee.com.br/product/1/2',
    cleanUrl: 'https://shopee.com.br/product/1/2',
    marketplace: 'Shopee',
    title: 'Smartphone Top de Linha',
    finalLinkToSend: 'https://s.shopee.com.br/affiliate',
    fetchedAt: new Date().toISOString(),
    incoming_url: 'https://shopee.com.br/product/1/2',
    canonical_url: 'https://shopee.com.br/product/1/2',
    reaffiliation_status: 'success',
    eligibility: { isEligible: true, status: 'eligible', reasons: [], offer_type: 'product_offer' },
    pixDisplayEligible: false
  };

  // --- CENÁRIO A: Produto com preço API apenas ---
  console.log('\n[CENÁRIO A] Produto com preço API apenas');
  const msgA = formatShopeeProductMessage({
    ...baseFactual,
    price: 1500,
    originalPrice: 2000,
    currentPriceSource: 'api.priceMin',
    priceFormatted: 'R$ 1.500,00',
    originalPriceFormatted: 'R$ 2.000,00'
  });
  console.log(msgA);
  console.assert(msgA.includes('~De: R$ 2.000,00~'), 'Deve conter De:');
  console.assert(msgA.includes('🔥 Por: R$ 1.500,00'), 'Deve conter Por:');
  console.assert(!msgA.includes('NO PIX'), 'Não deve conter NO PIX');
  console.assert(!msgA.includes('sem juros'), 'Não deve conter sem juros');

  // --- CENÁRIO B: Produto com Pix heurístico ---
  console.log('\n[CENÁRIO B] Produto com Pix heurístico');
  const msgB = formatShopeeProductMessage({
    ...baseFactual,
    price: 1500,
    estimatedPixPrice: 1380,
    estimatedPixSource: 'heuristic.pix_0_92',
    currentPriceSource: 'api.priceMin'
  });
  console.log(msgB);
  console.assert(!msgB.includes('NO PIX'), 'Não deve conter NO PIX (Heurística bloqueada)');

  // --- CENÁRIO C: Produto com parcelamento heurístico ---
  console.log('\n[CENÁRIO C] Produto com parcelamento heurístico');
  const msgC = formatShopeeProductMessage({
    ...baseFactual,
    price: 1500,
    installments: '3x de R$ 500,00',
    currentPriceSource: 'api.priceMin'
  });
  console.log(msgC);
  console.assert(!msgC.includes('sem juros'), 'Não deve conter sem juros (Heurística bloqueada)');

  // --- CENÁRIO D: Produto com cupom validado ---
  console.log('\n[CENÁRIO D] Produto com cupom validado');
  const msgD = formatShopeeProductMessage({
    ...baseFactual,
    price: 617,
    currentPriceSource: 'api.priceMin',
    coupons: [
      {
        marketplace: 'shopee',
        type: 'link_resgate',
        code: null,
        couponLabel: 'R$ 30 OFF em TODAS AS LOJAS',
        redemptionUrl: 'https://s.shopee.com.br/coupon',
        confidence: 0.9,
        status: 'candidate',
        dedupeKey: 'k1'
      }
    ]
  }, 'cupom de R$ 30 OFF acima de R$ 299');
  console.log(msgD);
  console.assert(msgD.includes('R$ 587,00 com cupom aplicado'), 'Deve conter preço calculado');
  console.assert(msgD.includes('resgate aqui e aplique o cupom de R$ 30 OFF'), 'Deve conter instrução de resgate');
  console.assert(msgD.includes('https://s.shopee.com.br/coupon'), 'Deve conter link do cupom');

  // --- CENÁRIO E: Produto abaixo do mínimo do cupom ---
  console.log('\n[CENÁRIO E] Produto abaixo do mínimo do cupom');
  const msgE = formatShopeeProductMessage({
    ...baseFactual,
    price: 250,
    currentPriceSource: 'api.priceMin',
    coupons: [
      {
        marketplace: 'shopee',
        type: 'link_resgate',
        code: null,
        couponLabel: 'R$ 30 OFF',
        redemptionUrl: 'https://s.shopee.com.br/coupon',
        confidence: 0.9,
        status: 'candidate',
        dedupeKey: 'k1'
      }
    ]
  }, 'cupom de R$ 30 OFF acima de R$ 299');
  console.log(msgE);
  console.assert(!msgE.includes('com cupom aplicado'), 'Não deve conter preço com cupom');

  // --- CENÁRIO F: Pix factual de texto ---
  console.log('\n[CENÁRIO F] Pix factual de texto');
  const msgF = formatShopeeProductMessage({
    ...baseFactual,
    price: 537.64,
    currentPriceSource: 'api.priceMin'
  }, 'Apenas R$ 537,64 no pix hoje');
  console.log(msgF);
  console.assert(msgF.includes('R$ 537,64 NO PIX'), 'Deve conter NO PIX (Factual)');

  // --- CENÁRIO G: Parcelamento factual de texto ---
  console.log('\n[CENÁRIO G] Parcelamento factual de texto');
  const msgG = formatShopeeProductMessage({
    ...baseFactual,
    price: 1066.99,
    currentPriceSource: 'api.priceMin'
  }, 'compre em 12x de R$ 88,91 sem juros');
  console.log(msgG);
  console.assert(msgG.includes('12x de R$ 88,91 - sem juros'), 'Deve conter parcelamento e sem juros (Factual)');

  console.log('\n--- [PRODUCT-MESSAGE-FORMATTER-TEST] CONCLUÍDO ---');
}

runTests().catch(e => {
  console.error('Falha nos testes:', e);
  process.exit(1);
});
