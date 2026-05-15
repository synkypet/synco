
import { extractShopeeCoupons } from './coupon-extractor';
import { formatShopeeCouponMessage } from './coupon-formatter';

const testCases = [
  {
    name: 'Link de Resgate 100 OFF',
    input: '🎟️Use o cupom: R$100 OFF| resgate aqui: https://s.shopee.com.br/60OBIqsPJf',
    expected: {
      type: 'link_resgate',
      couponLabel: '*R$100 OFF*',
      redemptionUrl: 'https://s.shopee.com.br/60OBIqsPJf'
    }
  },
  {
    name: 'Código com Asterisco e Emojis',
    input: '⚡ *PLUS15I2AF\n💸 R$15 OFF em compras a partir de R$65\n\nhttps://s.shopee.com.br/50VuGMn8BG',
    expected: {
      type: 'codigo',
      code: 'PLUS15I2AF',
      couponLabel: '*R$15 OFF* em compras a partir de *R$65*'
    }
  },
  {
    name: 'Código Isolado na Primeira Linha',
    input: 'T3N15SH0P33\nR$10 OFF acima de R$40\nhttps://s.shopee.com.br/5L8keyhSi0',
    expected: {
      type: 'codigo',
      code: 'T3N15SH0P33',
      couponLabel: '*R$10 OFF* acima de *R$40*'
    }
  },
  {
    name: 'Link de Resgate sem Código (R$30 OFF)',
    input: '🔥 CUPOM DE DESCONTO LIBERADO!\n\n⚡ R$30 OFF\n🔗 Resgate aqui:\nhttps://s.shopee.com.br/3Vh6TbeP92',
    expected: {
      type: 'link_resgate',
      couponLabel: '*R$30 OFF*',
      redemptionUrl: 'https://s.shopee.com.br/3Vh6TbeP92'
    }
  },
  {
    name: 'Evitar Falsos Positivos (SHOPEE)',
    input: '⚡ *SHOPEE\n💸 R$10 OFF\nhttps://s.shopee.com.br/test',
    expected: {
      type: 'link_resgate',
      code: null,
      couponLabel: '*R$10 OFF*'
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
