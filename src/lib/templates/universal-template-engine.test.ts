import { buildSmartContext, renderSmartTemplate, DEFAULT_TEMPLATES } from './universal-template-engine';
import { FactualData } from '../linkProcessor';

async function testTemplateEngine() {
  console.log('--- [TEST] UniversalTemplateEngine Safety ---');

  const mockFactual: FactualData = {
    originalUrl: 'https://shopee.com.br/product/123/456',
    cleanUrl: 'https://shopee.com.br/product/123/456',
    marketplace: 'Shopee',
    title: 'Produto Teste',
    finalLinkToSend: 'https://s.shopee.com.br/test',
    fetchedAt: new Date().toISOString(),
    incoming_url: 'https://shopee.com.br/product/123/456',
    canonical_url: 'https://shopee.com.br/product/123/456',
    reaffiliation_status: 'reaffiliated',
    pixDisplayEligible: false,
    eligibility: {
      isEligible: true,
      status: 'eligible',
      reasons: [],
      offer_type: 'product_offer'
    }
  };

  // Cenário A: Produto SEM preço
  const contextNoPrice = buildSmartContext(mockFactual);
  const resultNoPrice = renderSmartTemplate(DEFAULT_TEMPLATES.shopee_product, contextNoPrice);
  
  console.assert(resultNoPrice === '', 'Cenário A: Deve retornar string vazia para produto sem preço');
  if (resultNoPrice === '') console.log('✅ Cenário A: OK');
  else console.error('❌ Cenário A: FALHA. Retornou:', resultNoPrice);

  // Cenário B: Produto COM preço válido
  const mockWithPrice = { ...mockFactual, price: 57.54, currentPriceSource: 'api.priceMin' };
  const contextWithPrice = buildSmartContext(mockWithPrice);
  const resultWithPrice = renderSmartTemplate(DEFAULT_TEMPLATES.shopee_product, contextWithPrice);

  console.assert(resultWithPrice.includes('Por: R$ 57,54'), 'Cenário B: Deve conter o preço correto');
  console.assert(!resultWithPrice.includes('ITEM INVÁLIDO'), 'Cenário B: Não deve conter erro');
  if (resultWithPrice.includes('Por: R$ 57,54')) console.log('✅ Cenário B: OK');
  else console.error('❌ Cenário B: FALHA. Retornou:', resultWithPrice);

  console.log('--- [TEST] FIM ---');
}

testTemplateEngine();
