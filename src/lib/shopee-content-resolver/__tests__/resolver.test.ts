import { resolveShopeeCapturedContent } from '../index';

async function runTests() {
  console.log('🚀 Iniciando Testes do Resolver de Camada 2/3...\n');

  const cases = [
    {
      name: 'A. Link que resolve para produto (Mockado)',
      input: { 
        text: 'Olha esse item: https://shopee.com.br/product/123/456'
      },
      expected_target: 'products',
      expected_type: 'product_link'
    },
    {
      name: 'B. Link que resolve para voucher (sem contexto de cupom)',
      input: { 
        // Nenhuma keyword de cupom/off no texto — resolver usa apenas o destino da URL
        text: 'Confira as super ofertas: https://shopee.com.br/m/super-ofertas'
      },
      expected_target: 'promo_pages',
      expected_type: 'promo_landing'
    },
    {
      name: 'C. Texto com R$15 OFF + link válido (sem código explícito)',
      input: { 
        text: 'R$15 OFF! https://shopee.com.br/m/voucher-central'
      },
      expected_target: 'coupons',
      expected_type: 'verified_coupon'
    },
    {
      name: 'D. Produto com De/Por',
      input: { 
        text: 'De: R$ 100 Por: R$ 50. https://shopee.com.br/product/123/456'
      },
      expected_target: 'products',
      expected_type: 'product_link'
    },
    {
      name: 'E. Link quebrado/inválido',
      input: { 
        text: 'https://shopee.com.br/cart' // Carrinho é bloqueado
      },
      expected_target: 'none',
      expected_type: 'rejected'
    },
    {
      // Caso principal do teste de produção:
      // Mensagem completa com Código + benefício OFF + link /m/ de resgate
      // DEVE ser classified como verified_coupon, NÃO promo_landing
      name: 'F. Mensagem completa: Código M0Z4010 + R$15 OFF + link voucher',
      input: {
        text: [
          '🔥 CUPOM SHOPEE LIBERADO!',
          '',
          '🎟️ Código: M0Z4010',
          '💸 R$15 OFF em compras acima de R$99',
          '',
          '🔗 Resgate aqui:',
          'https://shopee.com.br/m/voucher-wallet'
        ].join('\n')
      },
      expected_target: 'coupons',
      expected_type: 'verified_coupon'
    },
    {
      // Caso inverso: URL de voucher-wallet SEM código e SEM contexto de cupom
      // DEVE ser promo_landing, não verified_coupon
      name: 'G. Só link voucher-wallet, sem código e sem contexto de cupom',
      input: {
        text: 'https://shopee.com.br/m/voucher-wallet'
      },
      expected_target: 'promo_pages',
      expected_type: 'promo_landing'
    },
    {
      // Caso extra: Título de cupom mas sem código e sem benefício OFF
      // ANTES: promo_landing | AGORA: verified_coupon (devido à intenção de cupom + link de voucher)
      name: 'H. Título sem código e sem OFF',
      input: {
        text: '🔥 CUPOM SHOPEE LIBERADO! https://shopee.com.br/m/voucher-wallet'
      },
      expected_target: 'coupons',
      expected_type: 'verified_coupon'
    }
  ];

  let passed = 0;
  for (const c of cases) {
    const result = await resolveShopeeCapturedContent(c.input);
    const successType = result.content_type === c.expected_type;
    const successTarget = result.accepted_target === c.expected_target;
    const success = successType && successTarget;
    
    console.log(`${success ? '✅' : '❌'} [${c.name}]`);
    console.log(`   Esperado Type:   ${c.expected_type} | Obtido: ${result.content_type}`);
    console.log(`   Esperado Target: ${c.expected_target} | Obtido: ${result.accepted_target}`);
    console.log(`   coupon_code: ${result.coupon_code || '(nenhum)'}`);
    console.log(`   Reasons: ${result.reasons.join(' | ')}`);
    if (success) passed++;
  }

  console.log(`\n📊 Resultado: ${passed}/${cases.length} testes passados.`);
  if (passed !== cases.length) process.exit(1);
}

runTests();
