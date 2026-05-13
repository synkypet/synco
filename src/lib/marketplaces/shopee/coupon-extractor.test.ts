
import { extractShopeeCoupons } from './coupon-extractor';
import { formatShopeeCouponMessage } from './coupon-formatter';

const testCases = [
  {
    name: 'Link de Resgate 100 OFF',
    input: '🎟️Use o cupom: R$100 OFF| resgate aqui: https://s.shopee.com.br/60OBIqsPJf',
    expected: {
      type: 'link_resgate',
      couponLabel: 'R$100 OFF',
      redemptionUrl: 'https://s.shopee.com.br/60OBIqsPJf'
    }
  },
  {
    name: 'Link de Resgate 50 OFF',
    input: '🎟️Use o cupom: R$50 OFF| resgate aqui: https://s.shopee.com.br/gMfczVZwO',
    expected: {
      type: 'link_resgate',
      couponLabel: 'R$50 OFF',
      redemptionUrl: 'https://s.shopee.com.br/gMfczVZwO'
    }
  },
  {
    name: 'Código Explícito',
    input: '🎟️Use o cupom: M0D4555HP',
    expected: {
      type: 'codigo',
      code: 'M0D4555HP'
    }
  },
  {
    name: 'Página de Cupons (S.SHOPEE)',
    input: '🔗 RESGATE OS CUPONS AQUI:\nhttps://s.shopee.com.br/gMfczVZwO',
    expected: {
      type: 'pagina_cupons',
      redemptionUrl: 'https://s.shopee.com.br/gMfczVZwO'
    }
  },
  {
    name: 'Página de Cupons (BR.SHP.EE)',
    input: 'Confira Cupom de Desconto Shopee 2026 na Shopee! https://br.shp.ee/CKfvC8dB',
    expected: {
      type: 'pagina_cupons',
      redemptionUrl: 'https://br.shp.ee/CKfvC8dB'
    }
  },
  {
    name: 'URL com Pontuação Final',
    input: 'Confira Cupom de Desconto Shopee 2026 na Shopee! https://br.shp.ee/CKfvC8dB.',
    expected: {
      redemptionUrl: 'https://br.shp.ee/CKfvC8dB'
    }
  }
];

function runTests() {
  console.log('--- INICIANDO TESTES DO MOTOR DE CUPONS SHOPEE ---\n');
  let passed = 0;
  let failed = 0;

  testCases.forEach((tc, index) => {
    console.log(`Teste ${index + 1}: ${tc.name}`);
    const results = extractShopeeCoupons(tc.input);
    const result = results[0];

    if (!result) {
      console.error('  [FAIL] Nenhum cupom extraído.');
      failed++;
      return;
    }

    let match = true;
    Object.keys(tc.expected).forEach((key) => {
      const expectedValue = (tc.expected as any)[key];
      const actualValue = (result as any)[key];
      if (expectedValue !== actualValue) {
        console.error(`  [FAIL] Campo "${key}": esperado "${expectedValue}", obtido "${actualValue}"`);
        match = false;
      }
    });

    if (match) {
      console.log('  [PASS]');
      passed++;
      // Mostrar exemplo de formatação para o primeiro de cada tipo
      console.log('  Mensagem Formatada:');
      console.log(formatShopeeCouponMessage(result).split('\n').map(l => '    ' + l).join('\n'));
    } else {
      failed++;
    }
    console.log('');
  });

  console.log(`--- RESULTADO FINAL ---`);
  console.log(`Sucessos: ${passed}`);
  console.log(`Falhas: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
