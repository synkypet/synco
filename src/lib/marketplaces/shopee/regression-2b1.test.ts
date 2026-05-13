
import { processLinks, detectMarketplace, classifyOffer, validateEligibility } from '@/lib/linkProcessor';
import { extractShopeeCoupons } from './coupon-extractor';

async function runRegression() {
  console.log('--- INICIANDO TESTES DE REGRESSÃO FASE 2B.1 ---\n');

  const scenarios = [
    {
      id: 'A',
      name: 'Produto Shopee normal',
      input: '🛒 COMPRE AQUI: https://shopee.com.br/product/123/456',
      link: 'https://shopee.com.br/product/123/456',
      factual: { title: 'Smartphone XYZ', price: 1500, image: 'img.jpg', originalUrl: 'https://shopee.com.br/product/123/456', itemId: '456', shopId: '123', reaffiliation_status: 'reaffiliated' },
      expected: { type: 'product_offer', isEligible: true }
    },
    {
      id: 'B',
      name: 'Cupom Shopee com contexto',
      input: '🎟️Use o cupom: R$50 OFF| resgate aqui: https://s.shopee.com.br/gMfczVZwO',
      link: 'https://s.shopee.com.br/gMfczVZwO',
      factual: { title: 'Sem Título', price: 0, originalUrl: 'https://s.shopee.com.br/gMfczVZwO', reaffiliation_status: 'resolved' },
      expected: { type: 'coupon_offer', isEligible: true, status: 'warning' }
    },
    {
      id: 'C',
      name: 'Link Shopee promocional sem contexto',
      input: 'Confira: https://shopee.com.br/m/alguma-campanha-generica',
      link: 'https://shopee.com.br/m/alguma-campanha-generica',
      factual: { title: 'Sem Título', price: 0, originalUrl: 'https://shopee.com.br/m/alguma-campanha-generica', reaffiliation_status: 'resolved' },
      expected: { type: 'product_offer', isEligible: false } // Sem contexto de cupom nem dados de produto
    },
    {
      id: 'D',
      name: 'Link externo com Shopee no parâmetro',
      input: 'https://site-externo.com/?url=https://shopee.com.br/m/cupom-de-desconto',
      link: 'https://site-externo.com/?url=https://shopee.com.br/m/cupom-de-desconto',
      factual: { title: 'Site Externo', price: 0, originalUrl: 'https://site-externo.com/?url=https://shopee.com.br/m/cupom-de-desconto' },
      expected: { marketplace: 'Unknown' }
    },
    {
      id: 'E',
      name: 'URL Shopee com pontuação final',
      input: 'Confira Cupom de Desconto Shopee 2026 na Shopee! https://br.shp.ee/CKfvC8dB.',
      expected_url: 'https://br.shp.ee/CKfvC8dB'
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const sc of scenarios) {
    console.log(`Cenário ${sc.id}: ${sc.name}`);
    
    if (sc.id === 'E') {
      const coupons = extractShopeeCoupons(sc.input);
      const url = coupons[0]?.redemptionUrl;
      if (url === sc.expected_url) {
        console.log('  [PASS] URL limpa corretamente.');
        passed++;
      } else {
        console.error(`  [FAIL] URL esperada "${sc.expected_url}", obtida "${url}"`);
        failed++;
      }
      continue;
    }

    const marketplace = detectMarketplace(sc.link!);
    if (sc.id === 'D') {
      if (marketplace === 'Unknown') {
        console.log('  [PASS] Link externo identificado como Unknown.');
        passed++;
      } else {
        console.error(`  [FAIL] Link externo identificado como ${marketplace}`);
        failed++;
      }
      continue;
    }

    const classification = classifyOffer(sc.input, sc.factual as any);
    const eligibility = validateEligibility(sc.factual as any, classification.type);

    const expected = sc.expected as any;
    let match = true;
    if (classification.type !== expected.type) {
      console.error(`  [FAIL] Tipo esperado "${expected.type}", obtido "${classification.type}"`);
      match = false;
    }
    if (eligibility.isEligible !== expected.isEligible) {
      console.error(`  [FAIL] Elegibilidade esperada "${expected.isEligible}", obtida "${eligibility.isEligible}"`);
      match = false;
    }
    if (expected.status && eligibility.status !== expected.status) {
       console.error(`  [FAIL] Status esperado "${expected.status}", obtido "${eligibility.status}"`);
       match = false;
    }

    if (match) {
      console.log('  [PASS]');
      passed++;
    } else {
      failed++;
    }
  }

  console.log(`\nRESULTADO: ${passed} Passaram, ${failed} Falharam.`);
  if (failed > 0) process.exit(1);
}

runRegression().catch(console.error);
