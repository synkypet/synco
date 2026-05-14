// src/lib/marketplaces/shopee/product-raw-text-pricing.test.ts
import { generatePricingInsight, formatSmartMessage } from './pricing-logic';
import { FactualData } from '@/lib/linkProcessor';

/**
 * Mock de FactualData básico
 */
const baseFactual: FactualData = {
  originalUrl: 'https://shopee.com.br/product/123/456',
  cleanUrl: 'https://shopee.com.br/product/123/456',
  marketplace: 'Shopee',
  title: 'Penteadeira de quarto Luxo',
  price: 617,
  originalPrice: 630,
  currentPriceFactual: 617,
  currentPriceSource: 'api.price',
  pixDisplayEligible: false,
  finalLinkToSend: 'https://s.shopee.com.br/product_link',
  fetchedAt: new Date().toISOString(),
  incoming_url: 'https://shopee.com.br/product/123/456',
  canonical_url: 'https://shopee.com.br/product/123/456',
  reaffiliation_status: 'success',
  eligibility: { isEligible: true, status: 'eligible', reasons: [], offer_type: 'product_offer' },
  coupons: [
    {
      marketplace: 'shopee',
      couponLabel: 'R$ 30 OFF',
      type: 'codigo',
      code: 'OFF30',
      redemptionUrl: 'https://s.shopee.com.br/coupon_link',
      confidence: 1.0,
      status: 'valid',
      dedupeKey: 'mock-123'
    }
  ]
};

async function runTests() {
  console.log('--- [PRODUCT-RAW-TEXT-PRICING-TEST] INICIANDO ---');

  // --- CENÁRIO A: Penteadeira (Rich Data) ---
  console.log('\n[CENÁRIO A] Penteadeira (Rich Data)');
  const rawTextA = `
🛍️ Penteadeira de quarto Luxo com 4 gavetas Mesa de maquiagem multifuncional LED branca Yesop

de R$ 630
🔥Por: R$ 537,64 NO PIX com cupom
💳 ou 11x de R$ 53,36 - sem juros

📦Compre aqui: https://s.shopee.com.br/6fe7UDnB8Q

Para chegar nesse valor, resgate aqui e aplique o cupom de R$ 30 OFF em TODAS AS LOJAS:
https://s.shopee.com.br/gMuLCBBjy
  `;

  const insightA = generatePricingInsight(baseFactual, rawTextA);
  const msgA = formatSmartMessage(insightA, 'https://s.shopee.com.br/product_link', 'https://s.shopee.com.br/coupon_link');

  console.log(msgA);
  console.assert(msgA.includes('De: R$ 630,00'), 'Deve exibir preço original Penteadeira');
  console.assert(msgA.includes('🔥 Por: R$ 537,64 NO PIX com cupom'), 'Deve exibir preço Pix Penteadeira');
  console.assert(msgA.includes('11x de R$ 53,36 - sem juros'), 'Deve exibir parcelamento Penteadeira');
  console.assert(msgA.includes('R$ 30 OFF em TODAS AS LOJAS'), 'Deve exibir bloco de cupom Penteadeira');
  console.assert(msgA.includes('https://s.shopee.com.br/coupon_link'), 'Deve usar link de cupom re-afiliado');

  // --- CENÁRIO B: Lava e Seca ---
  console.log('\n[CENÁRIO B] Lava e Seca');
  const factualB: FactualData = {
    ...baseFactual,
    title: 'Lava e Seca Philco 11kg',
    price: 2453.55,
    originalPrice: 3290
  };
  const rawTextB = `
🛍️ Lava e Seca Philco 11kg
🔥 Por: R$ 2.363,55 NO PIX com cupom
💳 ou 12x de R$ 214,74 - sem juros
Cupom R$ 90 OFF
  `;
  const insightB = generatePricingInsight(factualB, rawTextB);
  const msgB = formatSmartMessage(insightB, 'https://s.shopee.com.br/product_link');

  console.log(msgB);
  console.assert(msgB.includes('R$ 2.363,55 NO PIX com cupom'), 'Deve exibir preço Pix Lava e Seca');
  console.assert(msgB.includes('12x de R$ 214,74 - sem juros'), 'Deve exibir parcelamento Lava e Seca');

  // --- CENÁRIO C: Sem raw_text premium ---
  console.log('\n[CENÁRIO C] Sem raw_text premium');
  const rawTextC = `apenas link: https://s.shopee.com.br/123...`;
  const insightC = generatePricingInsight(baseFactual, rawTextC);
  const msgC = formatSmartMessage(insightC, 'https://s.shopee.com.br/product_link', 'https://s.shopee.com.br/coupon_link');

  console.log(msgC);
  console.assert(!msgC.includes('NO PIX'), 'Não deve exibir NO PIX se não estiver no texto');
  console.assert(!msgC.includes('sem juros'), 'Não deve exibir sem juros se não estiver no texto');

  // --- CENÁRIO H: ProductName divergente ---
  console.log('\n[CENÁRIO H] ProductName divergente');
  const rawTextH = `
🛍️ cadeira gamer profissional
de r$ 1000
🔥por: R$ 500 no pix
  `;
  const insightH = generatePricingInsight(baseFactual, rawTextH);
  const msgH = formatSmartMessage(insightH, 'https://s.shopee.com.br/product_link');
  
  console.assert(!msgH.includes('R$ 500,00'), 'Deve ignorar dados de produto divergente');

  // --- CENÁRIO J: Parcelamento inconsistente ---
  console.log('\n[CENÁRIO J] Parcelamento inconsistente');
  const rawTextJ = `11x de r$ 10,00 sem juros...`; // Total 110, price 617
  const insightJ = generatePricingInsight(baseFactual, rawTextJ);
  console.assert(!insightJ.canDisplayInstallments, 'Deve rejeitar parcelamento inconsistente');

  console.log('\n--- [PRODUCT-RAW-TEXT-PRICING-TEST] CONCLUÍDO ---');
}

runTests().catch(console.error);
