import { processLinks } from '../../linkProcessor';
import { ShopeeAdapter } from '../ShopeeAdapter';

// Monkey-patch para evitar chamadas reais
// @ts-ignore
ShopeeAdapter.prototype.generateAffiliateLink = async (url: string) => {
  return url + '?aff_id=user_aff';
};

// Mock do ShopeeAdapter para evitar chamadas reais de rede se necessário, 
// mas aqui queremos testar a integração com a lógica de classificação.
// Para os testes de integração, usaremos os links reais e deixaremos o processador resolver.

async function testPromoLanding() {
  console.log('🧪 Iniciando testes de Promo Landing Shopee (Fase 2F.1A)...');

  const testLinks = [
    'https://br.shp.ee/dtjrUtP5', // Super Ofertas (Short)
    'https://s.shopee.com.br/8fPBfYv2bg?share_channel_code=1', // Super Ofertas (Short S)
    'https://shopee.com.br/m/super-ofertas?mmp_pid=an_18310690288', // Direto Afiliado
    'https://shopee.com.br/m/super-ofertas?uls_trackid=55l3l7l300gr', // Direto Sem Afiliado
    'https://shopee.com.br/product/123/456' // Produto Normal
  ];

  const userConnections = [
    {
      marketplace_name: 'shopee',
      shopee_app_id: 'test_app_id',
      shopee_app_secret: 'test_app_secret'
    }
  ];

  const results = await processLinks(testLinks, userConnections);

  results.forEach((res, index) => {
    const link = testLinks[index];
    console.log(`\n--- Teste ${index + 1}: ${link} ---`);
    console.log(`Marketplace: ${res.factual.marketplace}`);
    console.log(`Offer Type: ${res.factual.eligibility.offer_type}`);
    console.log(`Landing Type: ${res.factual.landing_type || 'N/A'}`);
    console.log(`Status Reafiliação: ${res.factual.reaffiliation_status}`);
    console.log(`Título: ${res.factual.title}`);
    console.log(`Mensagem Preview: ${res.copy.messageText.substring(0, 50)}...`);

    // Validações
    if (link.includes('super-ofertas') || index < 4) {
      if (res.factual.eligibility.offer_type !== 'promo_landing') {
        console.error('❌ ERRO: Deveria ser promo_landing');
      } else {
        console.log('✅ OK: Classificado como promo_landing');
      }

      if (res.factual.landing_type !== 'super_ofertas') {
        console.error('❌ ERRO: landing_type deveria ser super_ofertas');
      } else {
        console.log('✅ OK: landing_type correto');
      }

      if (!res.copy.messageText.includes('ACESSO VIP SHOPEE LIBERADO')) {
        console.error('❌ ERRO: Copy incorreta');
      } else {
        console.log('✅ OK: Copy correta');
      }
    } else {
      if (res.factual.eligibility.offer_type !== 'product_offer') {
        console.error('❌ ERRO: Produto normal deveria ser product_offer');
      } else {
        console.log('✅ OK: Produto normal classificado corretamente');
      }
    }
  });

  console.log('\n--- Fim dos testes ---');
}

testPromoLanding().catch(err => {
  console.error('Erro nos testes:', err);
  process.exit(1);
});
