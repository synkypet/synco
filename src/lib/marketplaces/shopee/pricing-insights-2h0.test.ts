
import { extractShopeeCoupons } from './coupon-extractor';

/**
 * Teste de Auditoria FASE 2H.0
 * Objetivo: Validar extração de cupons e identificar onde podemos extrair valores numéricos.
 */
async function runAuditTest() {
  console.log('--- [PRICING-AUDIT-2H0] INICIANDO ---');

  const sampleMessages = [
    {
      name: 'Cupom R$30 OFF',
      text: 'Para chegar nesse valor, resgate aqui e aplique o cupom de R$ 30 OFF em TODAS AS LOJAS: https://s.shopee.com.br/gMuLCBBjy'
    },
    {
      name: 'Cupom 10% OFF',
      text: 'Cupom 10% OFF acima de R$ 99: https://s.shopee.com.br/xyz123'
    },
    {
      name: 'Cupom R$50 OFF Mínimo 499',
      text: '🎟️ R$50 OFF acima de R$499: https://s.shopee.com.br/abc456'
    }
  ];

  for (const msg of sampleMessages) {
    console.log(`\n>>> Analisando: ${msg.name}`);
    const coupons = extractShopeeCoupons(msg.text);
    
    if (coupons.length > 0) {
      const c = coupons[0];
      console.log(`  Label capturada: "${c.couponLabel}"`);
      
      // Simulação de parsing numérico (Proposta 2H.1A)
      const label = c.couponLabel || '';
      const amountMatch = label.match(/(?:R\$\s*)?(\d+)\s*(?:OFF|%)/i);
      const minSpendMatch = msg.text.match(/(?:acima de|mínimo|min)\s*(?:R\$\s*)?(\d+)/i);
      
      const amount = amountMatch ? parseInt(amountMatch[1]) : null;
      const minSpend = minSpendMatch ? parseInt(minSpendMatch[1]) : null;
      const isPercentage = label.includes('%');

      console.log(`  [INSIGHT] Valor Estimado: ${amount}${isPercentage ? '%' : ' BRL'}`);
      console.log(`  [INSIGHT] Mínimo Estimado: ${minSpend || 'Não detectado'}`);
    } else {
      console.log('  ❌ Nenhum cupom detectado.');
    }
  }

  console.log('\n--- [PRICING-AUDIT-2H0] CONCLUÍDO ---');
}

runAuditTest().catch(console.error);
