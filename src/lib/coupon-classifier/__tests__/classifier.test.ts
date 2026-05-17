import { classifyShopeeCapturedContent } from '../index';

function runTests() {
  console.log('🚀 Iniciando Testes do Classificador de Camada 1 (REFINADO)...\n');

  const cases = [
    {
      name: 'Header não vira código',
      input: { text: '🔥 CUPOM SHOPEE LIBERADO! 🔥' },
      expected: 'candidate' // Contém a palavra CUPOM, então é candidato
    },
    {
      name: 'Código com markdown (*COLISEUM*)',
      input: {
        text: '🎟️ Código: *COLISEUM*',
        redemption_url: 'https://shopee.com.br/m/voucher-wallet'
      },
      expected: 'verified_coupon'
    },
    {
      name: 'Código com markdown duplo (**COLISEUM**)',
      input: {
        text: '🎟️ Código: **COLISEUM**',
        redemption_url: 'https://shopee.com.br/m/voucher-wallet'
      },
      expected: 'verified_coupon'
    },
    {
      name: 'Cupom sujeito não vira código',
      input: { text: '⚠️ Cupom sujeito à disponibilidade' },
      expected: 'candidate'
    },
    {
      name: 'Cupom com dois-pontos',
      input: {
        text: 'Cupom: COLISEUM',
        redemption_url: 'https://shopee.com.br/m/voucher-wallet'
      },
      expected: 'verified_coupon'
    },
    {
      name: 'Use o cupom',
      input: {
        text: 'Use o cupom COLISEUM',
        redemption_url: 'https://shopee.com.br/m/voucher-wallet'
      },
      expected: 'verified_coupon'
    },
    {
      name: 'BICICLETA explícito mas blacklist',
      input: {
        text: 'Código: *BICICLETA*',
        redemption_url: 'https://shopee.com.br/m/voucher-wallet'
      },
      expected: 'promo_landing' // Blacklist + URL de voucher
    },
    {
      name: 'COLISEUM completo (Shortlink)',
      input: {
        text: [
          '🔥 CUPOM SHOPEE LIBERADO! 🔥',
          '🎟️ Código: *COLISEUM*',
          '🔗 Resgate aqui:',
          'https://s.shopee.com.br/9UyKUm42n7'
        ].join('\n')
      },
      expected: 'candidate' // Shortlink na Camada 1 = candidate
    },
    {
      name: 'Produto (De: Por:)',
      input: { 
        text: 'De: R$ 100 Por: R$ 50',
        redemption_url: 'https://shopee.com.br/product/123/456'
      },
      expected: 'product_link'
    }
  ];

  let passed = 0;
  cases.forEach(c => {
    const result = classifyShopeeCapturedContent(c.input);
    const success = result.content_type === c.expected;
    console.log(`${success ? '✅' : '❌'} [${c.name}]`);
    console.log(`   Esperado: ${c.expected} | Obtido: ${result.content_type}`);
    console.log(`   Código extraído: ${result.coupon_code || '(nenhum)'}`);
    if (result.debug) {
      console.log(`   Debug Raw: ${result.debug.explicit_code_raw || '(nenhum)'}`);
      console.log(`   Debug Norm: ${result.debug.explicit_code_normalized || '(nenhum)'}`);
      console.log(`   Debug Rejected: ${result.debug.explicit_code_reject_reason || '(não)'}`);
    }
    if (success) passed++;
  });

  console.log(`\n📊 Resultado: ${passed}/${cases.length} testes passados.`);
  if (passed !== cases.length) process.exit(1);
}

runTests();
