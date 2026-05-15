
import { classifyShopeeContentForCoupon } from '../../lib/marketplaces/shopee/coupon-classifier';

/**
 * Testes Factuais para o Classificador Rígido (RADAR-FACTUAL-V3)
 */
async function testRigidClassification() {
  console.log('🧪 Iniciando testes de classificação rígida Shopee...');

  const scenarios = [
    {
      name: 'Cupom Real Puro',
      text: '🔥 CUPOM SHOPEE LIBERADO! 🔥\n\n🎟️ Código: PLUS15I2AF\n💸 R$15 OFF em compras a partir de R$65\n\n🔗 Resgate aqui:\nhttps://s.shopee.com.br/abcd',
      expected: 'verified_coupon'
    },
    {
      name: 'Oferta de Produto com Preço (Deve ser rejeitado como cupom)',
      text: '🛍️ Copa do Mundo 2026 Contém 100 Envelopes Oficial Panini\n\nDe: R$ 760,87\n🔥 Por: R$ 574,00 NO PIX\n💳 ou 12x de R$ 52,50 - sem juros\n\nhttps://s.shopee.com.br/4LGE8HsVvP',
      expected: 'product_offer'
    },
    {
      name: 'Link que resolve para Produto (Checklist 7)',
      text: 'Olha esse item: https://shopee.com.br/product-i.123.456',
      factual: { canonical_url: 'https://shopee.com.br/product/123/456' },
      expected: 'rejected'
    },
    {
      name: 'Produto com Cupom (Misto - Checklist 7)',
      text: 'Tênis Nike Air\n🔥 R$ 299,00\n🎟️ Use cupom NIKE10\nhttps://s.shopee.com.br/xyz',
      expected: 'product_with_coupon'
    },
    {
      name: 'Página de Cupons (Landing)',
      text: 'Resgate aqui todos os cupons do dia!',
      factual: { canonical_url: 'https://shopee.com.br/m/cupom-de-desconto' },
      expected: 'verified_coupon' // Classificado como cupom para Radar, mas não automation-puro se for só landing
    },
    {
      name: 'Super Ofertas (Promo Landing)',
      text: 'Super Ofertas da Noite!',
      factual: { canonical_url: 'https://shopee.com.br/m/super-ofertas' },
      expected: 'promo_landing'
    },
    {
      name: 'Link Genérico sem código (Unknown)',
      text: 'Link Shopee: https://s.shopee.com.br/123',
      expected: 'unknown'
    }
  ];

  let successCount = 0;
  const results = [];

  for (const scenario of scenarios) {
    const result = classifyShopeeContentForCoupon(scenario.text, scenario.factual || {});
    const pass = result.classification === scenario.expected;
    
    if (pass) successCount++;
    
    results.push({
      scenario: scenario.name,
      result: result.classification,
      reasons: result.reasons,
      pass
    });

    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${scenario.name} -> ${result.classification} (${result.reasons.join(', ')})`);
  }

  console.log(`\n--- RESULTADO FINAL DO DRY-RUN ---`);
  console.log(`Total: ${scenarios.length} | Sucessos: ${successCount}`);
  
  if (successCount === scenarios.length) {
    console.log('✨ O classificador rígido está operando conforme as especificações!');
  } else {
    console.error('❌ Algumas classificações divergiram do esperado.');
    process.exit(1);
  }
}

testRigidClassification().catch(err => {
  console.error('Erro crítico no teste:', err);
  process.exit(1);
});
