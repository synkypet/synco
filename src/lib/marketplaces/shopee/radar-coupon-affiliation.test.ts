import { ShopeeAdapter } from '../ShopeeAdapter';
import { canonicalizeShopeeUrl } from './url-canonicalizer';

async function testRadarAffiliation() {
  console.log('--- TESTE: RE-AFILIAÇÃO DE CUPONS RADAR ---');

  const adapter = new ShopeeAdapter();
  const mockConnection = {
    shopee_app_id: 'test_app_id',
    shopee_app_secret: 'test_secret'
  } as any;

  // Mock global fetch para simular resolução de short links
  const originalFetch = global.fetch;
  global.fetch = async (url: any, options: any) => {
    const urlStr = String(url);
    
    // Simular resolução de s.shopee para buyer/login com afiliado de terceiro
    if (urlStr === 'https://s.shopee.com.br/BQdeD2BfQ') {
      return {
        status: 302,
        headers: new Headers({
          'location': 'https://shopee.com.br/buyer/login?from=https%3A%2F%2Fshopee.com.br%2Fuser%2Fvoucher-wallet%3Fmmp_pid%3Dan_18363940729&mmp_pid=an_18363940729'
        })
      } as any;
    }

    // Simular resposta da API GraphQL da Shopee (generateShortLink)
    if (urlStr.includes('open-api.affiliate.shopee.com.br/graphql')) {
      const body = JSON.parse(options.body);
      if (body.query.includes('generateShortLink')) {
        const originUrl = body.variables.input.originUrl;
        // Simulamos o link gerado com o novo ID (o ID real não aparece no shortlink, mas o teste valida a canonicalização do input)
        return {
          ok: true,
          json: async () => ({
            data: {
              generateShortLink: {
                shortLink: `https://s.shopee.com.br/RE_AFFILIATED_USER_LINK`
              }
            }
          })
        } as any;
      }
    }

    return { status: 200, ok: true, json: async () => ({}) } as any;
  };

  try {
    // CENÁRIO A: Link curto com redirecionamento complexo e afiliado de terceiro
    console.log('\n>>> CENÁRIO A: Link curto -> login -> voucher-wallet com mmp_pid antigo');
    const inputA = 'https://s.shopee.com.br/BQdeD2BfQ';
    const resultA = await adapter.preProcessIncomingLink(inputA, mockConnection);
    
    console.log('Input:', inputA);
    console.log('Canônico:', resultA.canonical_url);
    console.log('Status:', resultA.reaffiliation_status);
    console.log('Gerado:', resultA.generated_affiliate_url);
    
    if (resultA.canonical_url?.includes('voucher-wallet') && 
        !resultA.canonical_url?.includes('an_18363940729') &&
        resultA.reaffiliation_status === 'reaffiliated') {
      console.log('✅ SUCESSO: Link limpo e re-afiliado.');
    } else {
      console.error('❌ FALHA: Link não foi limpo corretamente.');
    }

    // CENÁRIO B: Link direto com mmp_pid antigo
    console.log('\n>>> CENÁRIO B: Link direto com mmp_pid antigo');
    const inputB = 'https://shopee.com.br/user/voucher-wallet?mmp_pid=an_18363940729&utm_source=an_18363940729&type=0418';
    const resultB = await adapter.preProcessIncomingLink(inputB, mockConnection);
    
    console.log('Input:', inputB);
    console.log('Canônico:', resultB.canonical_url);
    console.log('Gerado:', resultB.generated_affiliate_url);
    
    if (resultB.canonical_url === 'https://shopee.com.br/user/voucher-wallet?type=0418' &&
        !resultB.generated_affiliate_url?.includes('an_18363940729')) {
      console.log('✅ SUCESSO: Parâmetros removidos e link re-afiliado.');
    } else {
      console.error('❌ FALHA: Parâmetros de terceiros persistiram.');
    }

    // CENÁRIO C: URL de login direta
    console.log('\n>>> CENÁRIO C: URL de login direta com next/from');
    const inputC = 'https://shopee.com.br/buyer/login?next=https%3A%2F%2Fshopee.com.br%2Fuser%2Fvoucher-wallet%3Fmmp_pid%3Dan_18363940729';
    const canonicalC = canonicalizeShopeeUrl(inputC);
    console.log('Input:', inputC);
    console.log('Extraído:', canonicalC);
    
    if (canonicalC.includes('voucher-wallet') && !canonicalC.includes('buyer/login')) {
      console.log('✅ SUCESSO: Destino extraído do wrapper de login.');
    } else {
      console.error('❌ FALHA: Não extraiu o destino do login.');
    }

    // CENÁRIO D: Falha de conexão
    console.log('\n>>> CENÁRIO D: Falha de conexão (sem credenciais)');
    const resultD = await adapter.preProcessIncomingLink(inputB, undefined);
    console.log('Status:', resultD.reaffiliation_status);
    console.log('Erro:', resultD.reaffiliation_error);
    
    if (resultD.reaffiliation_status === 'blocked') {
      console.log('✅ SUCESSO: Bloqueou re-afiliação sem credenciais.');
    } else {
      console.error('❌ FALHA: Deveria ter bloqueado.');
    }

  } finally {
    global.fetch = originalFetch;
  }

  console.log('\n--- TESTE CONCLUÍDO ---');
}

testRadarAffiliation().catch(console.error);
