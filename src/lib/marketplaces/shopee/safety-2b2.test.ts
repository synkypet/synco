
import { classifyOffer, validateEligibility } from '@/lib/linkProcessor';

async function runSafetyTest() {
  console.log('--- INICIANDO TESTES DE SEGURANÇA FASE 2B.2 ---\n');

  const scenarios = [
    {
      id: 'S1',
      name: 'Cupom Shopee Puro (Entrada do usuário)',
      input: '🎟️Use o cupom: R$50 OFF| resgate aqui: https://s.shopee.com.br/gMfczVZwO',
      link: 'https://s.shopee.com.br/gMfczVZwO',
      factual: { title: 'Sem Título', price: 0, originalUrl: 'https://s.shopee.com.br/gMfczVZwO', reaffiliation_status: 'resolved' },
      expected: { type: 'coupon_offer', isEligible: true, status: 'warning', dispatchable: false }
    },
    {
      id: 'S2',
      name: 'Produto + Cupom',
      input: '🛍 Produto Teste\n🎟️Use o cupom: R$50 OFF| resgate aqui: https://s.shopee.com.br/gMfczVZwO\n🛒COMPRE AQUI: https://s.shopee.com.br/7KtaQcBNky',
      links: [
        { url: 'https://s.shopee.com.br/gMfczVZwO', isProduct: false },
        { url: 'https://s.shopee.com.br/7KtaQcBNky', isProduct: true }
      ]
    }
  ];

  for (const sc of scenarios) {
    console.log(`Cenário ${sc.id}: ${sc.name}`);
    
    if (sc.id === 'S1') {
      const classification = classifyOffer(sc.input, sc.factual as any);
      const eligibility = validateEligibility(sc.factual as any, classification.type);
      
      const isCoupon = classification.type === 'coupon_offer';
      const isEligibleForDispatch = (eligibility.isEligible) && !isCoupon;

      console.log(`  - Tipo: ${classification.type}`);
      console.log(`  - Elegível (Factual): ${eligibility.isEligible} (${eligibility.status})`);
      console.log(`  - Despachável Automático: ${isEligibleForDispatch}`);

      const expected = sc.expected as any;
      if (isEligibleForDispatch === expected.dispatchable) {
        console.log('  [PASS] Bloqueio de despacho automático confirmado para cupom puro.');
      } else {
        console.error('  [FAIL] Cupom puro não foi bloqueado para despacho!');
        process.exit(1);
      }
    }

    if (sc.id === 'S2') {
       console.log('  Avaliando itens individuais da mensagem mista:');
       for (const l of sc.links!) {
         const factual = l.isProduct 
           ? { title: 'Produto Real', price: 100, image: 'img.jpg', originalUrl: l.url } 
           : { title: 'Sem Título', price: 0, originalUrl: l.url };
         
         const classification = classifyOffer(sc.input, factual as any);
         const eligibility = validateEligibility(factual as any, classification.type);
         const isCoupon = classification.type === 'coupon_offer';
         const isEligibleForDispatch = (eligibility.isEligible) && !isCoupon;

         console.log(`    * Link: ${l.url}`);
         console.log(`      - Tipo: ${classification.type}`);
         console.log(`      - Despachável: ${isEligibleForDispatch}`);

         if (l.isProduct && !isEligibleForDispatch) {
            // Se for produto válido, deveria ser despachável (ou product_with_coupon)
            if (classification.type === 'product_with_coupon' && eligibility.isEligible) {
               console.log('      [PASS] Produto com cupom mantido como despachável.');
            } else {
               console.error('      [FAIL] Produto válido foi bloqueado!');
               process.exit(1);
            }
         } else if (!l.isProduct && isEligibleForDispatch) {
            console.error('      [FAIL] Link de resgate de cupom permitido para despacho!');
            process.exit(1);
         } else {
            console.log('      [PASS] Comportamento correto.');
         }
       }
    }
  }

  console.log('\n--- TESTES DE SEGURANÇA CONCLUÍDOS COM SUCESSO ---');
}

runSafetyTest().catch(console.error);
