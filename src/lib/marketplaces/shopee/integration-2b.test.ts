
import { processLinks, detectMarketplace } from '@/lib/linkProcessor';
import { extractShopeeCoupons } from './coupon-extractor';

async function testIntegration() {
  console.log('--- TESTE DE INTEGRAÇÃO FASE 2B: MOTOR DE CUPONS (REVISADO) ---');

  const scenarios = [
    {
      name: 'Cenário 1: Produto + Cupom',
      input: '🎟️Use o cupom: R$50 OFF| resgate aqui: https://s.shopee.com.br/gMfczVZwO\n🛒COMPRE AQUI: https://s.shopee.com.br/7KtaQcBNky'
    },
    {
      name: 'Cenário 2: Apenas Código',
      input: '🎟️Use o cupom: M0D4555HP'
    },
    {
      name: 'Cenário 3: Página Central',
      input: 'Confira Cupom de Desconto Shopee 2026 na Shopee! https://br.shp.ee/CKfvC8dB'
    },
    {
      name: 'Cenário 4: Produto Normal',
      input: '🛒COMPRE AQUI: https://s.shopee.com.br/7KtaQcBNky'
    },
    {
      name: 'Cenário 5: Não Shopee',
      input: 'https://www.google.com'
    }
  ];

  for (const sc of scenarios) {
    console.log(`\n>>> ${sc.name}`);
    console.log(`Input: ${sc.input.replace('\n', ' [NL] ')}`);

    // 1. Extração de Cupons
    const coupons = extractShopeeCoupons(sc.input);
    console.log(`Cupons detectados: ${coupons.length}`);
    coupons.forEach(c => console.log(`  - [${c.type}] code: ${c.code}, label: ${c.couponLabel}, url: ${c.redemptionUrl}`));

    // 2. Extração de Links
    const urlRegex = /https?:\/\/[^\s]+/g;
    const links = (sc.input.match(urlRegex) || []).map(u => u.replace(/[.,\)!\]\}!]+$/, ''));
    
    if (links.length > 0) {
      console.log(`Links detectados: ${links.length}`);
      const { classifyOffer } = await import('@/lib/linkProcessor');
      
      for (const link of links) {
        const marketplace = detectMarketplace(link);
        if (marketplace === 'Shopee') {
          // Simulamos que o link de produto teria metadados factuais (title/price) 
          // enquanto o link de resgate puro não teria.
          const isProductLink = link.includes('7KtaQcBNky'); // Simulação
          const factual = isProductLink 
            ? { title: 'Produto Real', price: 99.90, originalUrl: link } 
            : { title: 'Sem Título', price: 0, originalUrl: link };

          const classification = classifyOffer(sc.input, factual);
          console.log(`  - [LINK:${link}] Classificação: ${classification.type} | Motivos: ${classification.reasons.join(', ')}`);
        } else {
          console.log(`  - [LINK:${link}] Marketplace: ${marketplace}`);
        }
      }
    } else if (coupons.length > 0) {
       console.log('Nenhum link detectado, mas cupom de código presente.');
    } else {
       console.log('Nenhum conteúdo Shopee detectado.');
    }
  }

  console.log('\n--- TESTE CONCLUÍDO ---');
}

testIntegration().catch(console.error);
