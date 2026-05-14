// src/lib/templates/universal-template-engine.test.ts
import { buildSmartContext, renderSmartTemplate, DEFAULT_TEMPLATES } from './universal-template-engine';
import { FactualData } from '../linkProcessor';

async function runTests() {
  console.log('--- [UNIVERSAL-TEMPLATE-ENGINE-TEST] INICIANDO ---');

  const baseFactual: FactualData = {
    originalUrl: 'https://shopee.com.br/product/1/2',
    cleanUrl: 'https://shopee.com.br/product/1/2',
    marketplace: 'Shopee',
    title: 'Fone de Ouvido Bluetooth',
    price: 100,
    currentPriceSource: 'api.price',
    priceFormatted: 'R$ 100,00',
    finalLinkToSend: 'https://s.shopee.com.br/affiliate',
    fetchedAt: new Date().toISOString(),
    incoming_url: 'https://shopee.com.br/product/1/2',
    canonical_url: 'https://shopee.com.br/product/1/2',
    reaffiliation_status: 'success',
    eligibility: { isEligible: true, status: 'eligible', reasons: [], offer_type: 'product_offer' },
    pixDisplayEligible: false
  };

  // --- CENÁRIO A: Produto padrão (Sem desconto) ---
  console.log('\n[CENÁRIO A] Produto padrão (Sem desconto)');
  const contextA = buildSmartContext(baseFactual);
  const msgA = renderSmartTemplate(DEFAULT_TEMPLATES.shopee_product, contextA);
  console.log(msgA);
  console.assert(msgA.includes('🔥 *Por: R$ 100,00*'), 'Deve conter preço atual');
  console.assert(!msgA.includes('~De:'), 'Não deve conter preço original');

  // --- CENÁRIO B: Produto com Preço Original e Pix ---
  console.log('\n[CENÁRIO B] Produto com Preço Original e Pix');
  const factualB: FactualData = {
    ...baseFactual,
    originalPrice: 150,
    originalPriceFormatted: 'R$ 150,00'
  };
  // Simular evidência factual de Pix no texto para habilitar o bloco
  const contextB = buildSmartContext(factualB, '🛍️ Fone: R$ 92 no pix');
  const msgB = renderSmartTemplate(DEFAULT_TEMPLATES.shopee_product, contextB);
  console.log(msgB);
  console.assert(msgB.includes('~De: R$ 150,00~'), 'Deve conter preço original');
  console.assert(msgB.includes('NO PIX'), 'Deve conter NO PIX validado');

  // --- CENÁRIO C: Variável Cupom Vazia ---
  console.log('\n[CENÁRIO C] Variável Cupom Vazia');
  const msgC = renderSmartTemplate('{{product_name}}\n{{coupon_block}}', contextA);
  console.log(`"${msgC}"`);
  console.assert(!msgC.includes('{{coupon_block}}'), 'Deve remover placeholder orfão');
  console.assert(msgC.split('\n').length === 1, 'Deve remover linhas vazias extras');

  // --- CENÁRIO D: Variável Insegura Legada ---
  console.log('\n[CENÁRIO D] Variável Insegura Legada');
  const templateD = '{{titulo}} - Preço: {{preco}}\nPix: {{pix}}';
  const msgD = renderSmartTemplate(templateD, contextA); // contextA não tem Pix
  console.log(msgD);
  console.assert(msgD.includes('Fone de Ouvido'), 'Deve mapear titulo legatário');
  console.assert(!msgD.includes('Pix:'), 'Deve remover linha de Pix se não houver valor seguro');

  // --- CENÁRIO E: Cupom Shopee ---
  console.log('\n[CENÁRIO E] Cupom Shopee');
  const factualE: FactualData = {
    ...baseFactual,
    eligibility: { ...baseFactual.eligibility, offer_type: 'coupon_offer' },
    coupons: [
      {
        marketplace: 'shopee',
        type: 'codigo',
        code: 'GANHEI20',
        couponLabel: 'R$ 20 OFF',
        confidence: 1.0,
        status: 'valid',
        dedupeKey: 'k1',
        redemptionUrl: 'https://s.shopee.com.br/coupon'
      }
    ]
  };
  const contextE = buildSmartContext(factualE);
  const msgE = renderSmartTemplate(DEFAULT_TEMPLATES.shopee_coupon, contextE);
  console.log(msgE);
  console.assert(msgE.includes('GANHEI20'), 'Deve conter código do cupom');
  console.assert(msgE.includes('R$ 20 OFF'), 'Deve conter valor do desconto');

  // --- CENÁRIO F: Super Ofertas ---
  console.log('\n[CENÁRIO F] Super Ofertas');
  const factualF: FactualData = {
    ...baseFactual,
    eligibility: { ...baseFactual.eligibility, offer_type: 'promo_landing' },
    landing_type: 'super_ofertas'
  };
  const contextF = buildSmartContext(factualF);
  const msgF = renderSmartTemplate(DEFAULT_TEMPLATES.shopee_promo, contextF);
  console.log(msgF);
  console.assert(msgF.includes('ACESSO VIP SHOPEE'), 'Deve conter copy de Super Ofertas');
  console.assert(msgF.includes(baseFactual.finalLinkToSend), 'Deve conter o link');

  console.log('\n--- [UNIVERSAL-TEMPLATE-ENGINE-TEST] CONCLUÍDO ---');
}

runTests().catch(e => {
  console.error('Falha nos testes:', e);
  process.exit(1);
});
