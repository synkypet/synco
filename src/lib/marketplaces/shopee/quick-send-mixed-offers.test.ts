// Set dummy env vars BEFORE any imports
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

import { ShopeeAdapter } from '../ShopeeAdapter';

// Monkey-patch para evitar chamadas reais
// @ts-ignore
ShopeeAdapter.prototype.generateAffiliateLink = async (url: string) => {
  return url + '?aff_id=user_aff';
};

// Mock do Supabase para o CampaignService
const mockSupabase = {
  from: (table: string) => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data: { id: 'user_123', plan: 'pro' }, error: null }),
        in: () => Promise.resolve({ data: [{ id: 'group_1', channel_id: 'ch_1', name: 'G1' }], error: null }),
        eq: () => ({
            single: () => Promise.resolve({ data: { id: 'user_123', plan: 'pro' }, error: null })
        })
      }),
      in: () => Promise.resolve({ data: [{ id: 'group_1', channel_id: 'ch_1', name: 'G1' }], error: null })
    }),
    insert: () => ({
      select: () => ({
        single: () => Promise.resolve({ data: { id: 'camp_1' }, error: null }),
        then: (cb: any) => cb({ data: [{ id: 'job_1' }], error: null })
      }),
      then: (cb: any) => cb({ data: [{ id: 'job_1' }], error: null })
    }),
    update: () => ({
        eq: () => Promise.resolve({ error: null })
    })
  }),
  rpc: () => Promise.resolve({ data: true, error: null })
};

const clientPath = require.resolve('../../../lib/supabase/client');
delete require.cache[clientPath];
// @ts-ignore
require.cache[clientPath] = {
  id: clientPath,
  filename: clientPath,
  loaded: true,
  exports: {
    createClient: () => mockSupabase
  }
};

const { campaignService } = require('../../../services/supabase/campaign-service');

async function testMixedOffers() {
  console.log('🧪 Iniciando testes de Envio Misto (Fase 2F.1C - Bugfix)...');

  const couponItem = {
    product_id: 'coupon_1',
    product_name: 'Cupom R$50',
    custom_text: 'Use meu cupom!',
    affiliate_url: 'https://shopee.com.br/m/cupons',
    offer_type: 'coupon_offer'
  };

  const promoItem = {
    product_id: 'promo_1',
    product_name: 'Super Ofertas',
    custom_text: 'Acesso VIP!',
    affiliate_url: 'https://shopee.com.br/m/super-ofertas',
    offer_type: 'promo_landing'
  };

  const productItem = {
    product_id: 'prod_1',
    product_name: 'Produto Legal',
    custom_text: 'Compre agora!',
    affiliate_url: 'https://shopee.com.br/product/1/2',
    offer_type: 'product_offer'
  };

  // Cenário 1: Cupom + Promo Landing (O que causa o bug hoje)
  console.log('\n--- Cenário 1: Cupom + Promo Landing ---');
  try {
    await campaignService.createQuickSendCampaign('user_123', {
      origin: 'manual',
      items: [couponItem, promoItem],
      destinations: [{ id: 'group_1', type: 'group' }],
      metadata: { 
        confirmedByUser: true, 
        manualCouponSend: true,
        manualPromoLandingSend: true,
        source: 'quick_send'
      }
    });
    console.log('✅ Cenário 1: Passou (Bug não encontrado ou já corrigido)');
  } catch (err: any) {
    console.error('❌ Cenário 1: Falhou:', err.message);
  }

  // Cenário 2: Produto + Cupom + Promo
  console.log('\n--- Cenário 2: Produto + Cupom + Promo ---');
  try {
    await campaignService.createQuickSendCampaign('user_123', {
      origin: 'manual',
      items: [productItem, couponItem, promoItem],
      destinations: [{ id: 'group_1', type: 'group' }],
      metadata: { 
        confirmedByUser: true, 
        manualCouponSend: true,
        manualPromoLandingSend: true,
        source: 'quick_send'
      }
    });
    console.log('✅ Cenário 2: Passou');
  } catch (err: any) {
    console.error('❌ Cenário 2: Falhou:', err.message);
  }

  // Cenário 3: Radar tentando enviar misto (Bloqueio)
  console.log('\n--- Cenário 3: Radar enviando misto (Bloqueio) ---');
  try {
    await campaignService.create('user_123', {
      origin: 'radar',
      items: [couponItem, promoItem],
      destinations: [{ id: 'group_1', type: 'group' }],
      metadata: { 
        confirmedByUser: true, 
        manualCouponSend: true,
        manualPromoLandingSend: true,
        dispatchOrigin: 'quick_send_manual_mixed' // Forjando origin
      }
    });
    console.error('❌ Cenário 3: Falhou (Backend permitiu Radar enviar itens especiais)');
  } catch (err: any) {
    if (err.message.includes('confirmation_required')) {
      console.log('✅ Cenário 3: Bloqueado corretamente:', err.message);
    } else {
      console.error('❌ Cenário 3: Erro inesperado:', err.message);
    }
  }

  // Cenário 4: Misto faltando confirmação de cupom
  console.log('\n--- Cenário 4: Misto faltando confirmação de cupom ---');
  try {
    await campaignService.createQuickSendCampaign('user_123', {
      origin: 'manual',
      items: [couponItem, promoItem],
      destinations: [{ id: 'group_1', type: 'group' }],
      metadata: { 
        confirmedByUser: true, 
        manualCouponSend: false, // Faltando
        manualPromoLandingSend: true,
        source: 'quick_send'
      }
    });
    console.error('❌ Cenário 4: Falhou (Backend permitiu envio misto sem confirmação de cupom)');
  } catch (err: any) {
    if (err.message === 'manual_confirmation_required_for_special_offers') {
      console.log('✅ Cenário 4: Bloqueado corretamente:', err.message);
    } else {
      console.error('❌ Cenário 4: Erro inesperado:', err.message);
    }
  }

  // Cenário 5: Misto faltando confirmação de promo landing
  console.log('\n--- Cenário 5: Misto faltando confirmação de promo landing ---');
  try {
    await campaignService.createQuickSendCampaign('user_123', {
      origin: 'manual',
      items: [couponItem, promoItem],
      destinations: [{ id: 'group_1', type: 'group' }],
      metadata: { 
        confirmedByUser: true, 
        manualCouponSend: true,
        manualPromoLandingSend: false, // Faltando
        source: 'quick_send'
      }
    });
    console.error('❌ Cenário 5: Falhou (Backend permitiu envio misto sem confirmação de promo landing)');
  } catch (err: any) {
    if (err.message === 'manual_confirmation_required_for_special_offers') {
      console.log('✅ Cenário 5: Bloqueado corretamente:', err.message);
    } else {
      console.error('❌ Cenário 5: Erro inesperado:', err.message);
    }
  }

  console.log('\n--- Fim dos testes ---');
}

testMixedOffers().catch(err => {
  console.error('Erro nos testes:', err);
  process.exit(1);
});
