
import { renderSmartTemplate, DEFAULT_TEMPLATES } from './universal-template-engine';

async function runTests() {
  console.log('--- INICIANDO TESTES DO MOTOR DE TEMPLATES UNIVERSAL ---\n');
  let passed = 0;
  let failed = 0;

  const baseContext: any = {
    product_name: 'Produto Teste',
    affiliate_link: 'https://shope.ee/link-produto',
    smart_price_block: '🔥 *Por: R$ 99,90*',
    original_price_line: '~De: R$ 120,00~',
    current_price_line: '🔥 *Por: R$ 99,90*',
    coupon_block: '',
    disclaimer: '⚠️ Sujeito a alteração.',
    marketplace: 'Shopee',
    offer_type: 'product_offer'
  };

  const testCases = [
    {
      name: 'Renderização Completa de Produto',
      template: DEFAULT_TEMPLATES.shopee_product,
      context: baseContext,
      check: (res: string) => res.includes('Produto Teste') && res.includes('R$ 99,90')
    },
    {
      name: 'Remoção de Linha de Código Vazia em Cupom',
      template: DEFAULT_TEMPLATES.shopee_coupon,
      context: {
        ...baseContext,
        offer_type: 'coupon_offer',
        coupon_code: '',
        coupon_code_line: '',
        coupon_discount_line: '💸 *R$30 OFF*',
        coupon_link: 'https://s.shopee.com.br/3Vh6TbeP92',
        coupon_link_line: '🔗 *Resgate aqui:*\nhttps://s.shopee.com.br/3Vh6TbeP92'
      },
      check: (res: string) => !res.includes('Código:') && res.includes('R$30 OFF')
    },
    {
      name: 'Exibição de Código em Cupom',
      template: DEFAULT_TEMPLATES.shopee_coupon,
      context: {
        ...baseContext,
        offer_type: 'coupon_offer',
        coupon_code: 'PLUS15I2AF',
        coupon_code_line: '🎟️ *Código:* PLUS15I2AF',
        coupon_discount_line: '💸 *R$15 OFF*',
        coupon_link: 'https://s.shopee.com.br/link',
        coupon_link_line: '🔗 *Resgate aqui:*\nhttps://s.shopee.com.br/link'
      },
      check: (res: string) => res.includes('PLUS15I2AF') && res.includes('R$15 OFF')
    },
    {
      name: 'Persistência de CTA de Resgate Multiline',
      template: DEFAULT_TEMPLATES.shopee_coupon,
      context: {
        ...baseContext,
        offer_type: 'coupon_offer',
        coupon_discount_line: '💸 *R$15 OFF*',
        coupon_link_line: '🔗 *Resgate aqui:*\nhttps://s.shopee.com.br/link'
      },
      check: (res: string) => res.includes('Resgate aqui:') && res.includes('https://s.shopee.com.br/link')
    },
    {
      name: 'Remoção de Link de Resgate Vazio',
      template: DEFAULT_TEMPLATES.shopee_coupon,
      context: {
        ...baseContext,
        offer_type: 'coupon_offer',
        coupon_code: 'TESTE',
        coupon_code_line: '🎟️ *Código:* TESTE',
        coupon_link: '',
        coupon_link_line: ''
      },
      check: (res: string) => !res.includes('Resgate aqui:')
    }
  ];

  testCases.forEach((tc, index) => {
    console.log(`Teste ${index + 1}: ${tc.name}`);
    const result = renderSmartTemplate(tc.template, tc.context);
    
    if (tc.check(result)) {
      console.log('  [PASS]');
      passed++;
    } else {
      console.error('  [FAIL]');
      console.log('  --- RESULTADO OBTIDO ---');
      console.log(result);
      console.log('  ------------------------');
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
