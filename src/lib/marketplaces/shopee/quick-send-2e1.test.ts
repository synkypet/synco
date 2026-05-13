
import { processLinks, detectMarketplace } from '../../../lib/linkProcessor';
import { ShopeeAdapter } from '../../../lib/marketplaces/ShopeeAdapter';

/**
 * MOCK de Conexão Shopee para testes de Envio Rápido
 */
const mockConnection: any = {
  id: 'conn_shopee',
  marketplace_name: 'shopee',
  shopee_app_id: '123456',
  shopee_app_secret: 'abcdef'
};

/**
 * Monkey-patch ShopeeAdapter para evitar chamadas de rede durante os testes de integração
 */
const originalPreProcess = ShopeeAdapter.prototype.preProcessIncomingLink;
ShopeeAdapter.prototype.preProcessIncomingLink = async function(url, conn) {
  if (url.includes('s.shopee.com.br') || url.includes('br.shp.ee') || url.includes('/m/')) {
    return {
      incoming_url: url,
      canonical_url: url,
      reaffiliation_status: 'reaffiliated',
      generated_affiliate_url: `https://shope.ee/mock_affiliate_for_${Math.random().toString(36).substring(7)}`
    };
  }
  return originalPreProcess.call(this, url, conn);
};

const originalFetch = ShopeeAdapter.prototype.fetchMetadata;
ShopeeAdapter.prototype.fetchMetadata = async function(url, conn) {
  if (url.includes('shopee.com.br')) {
    return { name: 'Cupom/Promo Shopee Mock', marketplace: 'Shopee' } as any;
  }
  return originalFetch.call(this, url, conn);
};

async function testQuickSendCoupons() {
  console.log('--- INICIANDO TESTES DE ENVIO RÁPIDO (FASE 2E.1A) ---');

  // 1. Marketplace Detection para Landing Pages
  console.log('\nTeste 1: Detecção de Marketplace para Landing Pages');
  const urls = [
    'https://s.shopee.com.br/gMfczVZwO',
    'https://br.shp.ee/CKfvC8dB',
    'https://shopee.com.br/m/cupom-de-desconto'
  ];
  
  urls.forEach(url => {
    const mp = detectMarketplace(url);
    if (mp === 'Shopee') {
      console.log(`  [PASS] Detectado Shopee para: ${url}`);
    } else {
      console.log(`  [FAIL] Falha na detecção para: ${url} (Detectado: ${mp})`);
    }
  });

  // 2. Classificação de Cupom (Código Puro)
  console.log('\nTeste 2: Classificação de Cupom (Código Puro)');
  const textCode = '🎟️Use o cupom: M0D4555HP';
  const snapshotsCode = await processLinks([textCode], [mockConnection]);
  const sCode = snapshotsCode[0];
  
  if (sCode.factual.eligibility.offer_type === 'coupon_offer' && sCode.copy.messageText.includes('M0D4555HP')) {
    console.log('  [PASS] Cupom de código detectado e formatado.');
    console.log('  Mensagem:\n' + sCode.copy.messageText.split('\n').map(l => '    ' + l).join('\n'));
  } else {
    console.log('  [FAIL] Cupom de código NÃO detectado corretamente.');
  }

  // 3. Reafiliação de Landing Page (Simulada)
  console.log('\nTeste 3: Reafiliação de Landing Page (Simulada)');
  const urlLanding = 'https://s.shopee.com.br/gMfczVZwO';
  const adapter = new ShopeeAdapter();
  
  const reaffResult = await adapter.preProcessIncomingLink(urlLanding, mockConnection);
  if (reaffResult.reaffiliation_status === 'reaffiliated' && reaffResult.generated_affiliate_url?.includes('shope.ee')) {
    console.log('  [PASS] Landing page (cupom) reafiliada com sucesso.');
  } else {
    console.log('  [FAIL] Falha na reafiliação de landing page. Status:', reaffResult.reaffiliation_status);
  }

  // 4. Integração no Snapshot (Link de Resgate)
  console.log('\nTeste 4: Integração de Cupom com Link no Snapshot');
  // Usaremos um mock local de processLinks para evitar chamadas de rede reais
  const inputLink = '🎟️R$50 OFF: https://s.shopee.com.br/gMfczVZwO';
  
  // Simulando o comportamento do buildProductSnapshot com o novo formatter
  const snapshotsLink = await processLinks([inputLink], [mockConnection]);
  const sLink = snapshotsLink[0];
  
  if (sLink.factual.eligibility.offer_type === 'coupon_offer' && sLink.factual.reaffiliation_status === 'reaffiliated') {
    console.log('  [PASS] Cupom com link detectado e processado no Envio Rápido.');
    if (sLink.copy.messageText.includes('🔥 *CUPOM DE DESCONTO LIBERADO!*')) {
      console.log('  [PASS] Formatação especializada aplicada.');
    } else {
       console.log('  [FAIL] Formatação especializada NÃO aplicada. Mensagem:\n' + sLink.copy.messageText);
    }
  } else {
    console.log('  [FAIL] Falha no processamento de cupom com link. Status:', sLink.factual.reaffiliation_status);
  }

  // 5. Segurança: Produto Normal continua funcionando
  console.log('\nTeste 5: Segurança (Produto Normal continua funcionando)');
  const urlProduct = 'https://shopee.com.br/product/123/456';
  const snapshotsProd = await processLinks([urlProduct], [mockConnection]);
  const sProd = snapshotsProd[0];
  
  if (sProd.factual.eligibility.offer_type === 'product_offer') {
    console.log('  [PASS] Produto normal continua sendo identificado como product_offer.');
  } else {
    console.log('  [FAIL] Produto normal identificado incorretamente como:', sProd.factual.eligibility.offer_type);
  }

  console.log('\n--- TESTES DE ENVIO RÁPIDO CONCLUÍDOS ---');
}

testQuickSendCoupons().catch(console.error);
