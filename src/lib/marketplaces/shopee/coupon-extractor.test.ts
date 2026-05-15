
import { extractShopeeCoupons, normalizeShopeeCouponForMessage } from './coupon-extractor';
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

const normalizationTestCases = [
  {
    name: 'Normalização: Cupom Antigo com Código no Label',
    coupon: {
      code: '',
      coupon_label: 'PLUS15I2AF\nR$15 OFF em compras a partir de R$65\n⚠️ Corre porque esse cupom acaba rápido!\n👇',
      redemption_url: 'https://s.shopee.com.br/2g7zWLLon1'
    },
    expected: {
      code: 'PLUS15I2AF',
      discountLine: '💸 *R$15 OFF* em compras a partir de *R$65*'
    }
  },
  {
    name: 'Normalização: Cupom com Código Limpo',
    coupon: {
      code: 'T3N15SH0P33',
      coupon_label: '*R$10 OFF* acima de *R$40*',
      redemption_url: 'https://s.shopee.com.br/5L8keyhSi0'
    },
    expected: {
      code: 'T3N15SH0P33',
      discountLine: '💸 *R$10 OFF* acima de *R$40*'
    }
  },
  {
    name: 'Normalização: Evitar Duplicação de Emoji 💸',
    coupon: {
      code: 'PROMO15',
      coupon_label: '💸 💸 *R$15 OFF*',
      redemption_url: 'https://s.shopee.com.br/test'
    },
    expected: {
      code: 'PROMO15',
      discountLine: '💸 *R$15 OFF*'
    }
  },
  {
    name: 'Normalização: Remover Ruídos Legados (👇, urgência)',
    coupon: {
      code: 'CUPOM30',
      coupon_label: '💸 R$30 OFF\n👇 Resgate agora!\n⚠️ Corre porque esse cupom acaba rápido!',
      redemption_url: 'https://s.shopee.com.br/test'
    },
    expected: {
      code: 'CUPOM30',
      discountLine: '💸 *R$30 OFF* Resgate agora!'
    }
  }
];

function runTests() {
  console.log('--- INICIANDO TESTES DO MOTOR DE CUPONS SHOPEE ---\n');
  let passed = 0;
  let failed = 0;

  // 1. Testes de Extração
  console.log('--- TESTES DE EXTRAÇÃO ---\n');
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
    } else {
      failed++;
    }
    console.log('');
  });

  // 2. Testes de Normalização
  console.log('--- TESTES DE NORMALIZAÇÃO ---\n');
  normalizationTestCases.forEach((tc, index) => {
    console.log(`Teste Norm ${index + 1}: ${tc.name}`);
    const result = normalizeShopeeCouponForMessage(tc.coupon);
    
    let match = true;
    if (result.code !== tc.expected.code) {
      console.error(`  [FAIL] Código: esperado "${tc.expected.code}", obtido "${result.code}"`);
      match = false;
    }
    if (result.discountLine !== tc.expected.discountLine) {
      console.error(`  [FAIL] Label: esperado "${tc.expected.discountLine}", obtido "${result.discountLine}"`);
      match = false;
    }

    if (match) {
      console.log('  [PASS]');
      passed++;
    } else {
      failed++;
    }
    console.log('');
  });

  console.log(`--- RESULTADO FINAL ---`);
  console.log(`Sucessos: ${passed}`);
  console.log(`Falhas: ${failed}`);

  if (failed > 0) process.exit(1);
}

runTests();
