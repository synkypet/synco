/**
 * Utilitário especializado em canonicalização de URLs Shopee.
 * Focado em remover rastreios de terceiros e extrair destinos reais de wrappers de login.
 */

export const SHOPEE_AFFILIATE_PARAMS = [
  'mmp_pid',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'uls_trackid',
  'af_siteid',
  'pid',
  'smtt',
  'sp_atk',
  'xptdk',
  'af_click_lookback',
  'af_reengagement_window',
  'af_viewthrough_lookback',
  'is_retargeting',
  'af_sub_siteid'
];

export const SHOPEE_LOGIN_WRAPPERS = ['next', 'from', 'redirect'];

/**
 * Normaliza e limpa uma URL Shopee.
 */
export function canonicalizeShopeeUrl(url: string): string {
  if (!url) return '';
  
  try {
    let currentUrl = url;
    
    // 1. Tentar extrair de wrappers de login (recursivamente até 3 níveis)
    for (let i = 0; i < 3; i++) {
      const parsed = new URL(currentUrl);
      let extracted = false;
      
      for (const wrapper of SHOPEE_LOGIN_WRAPPERS) {
        const target = parsed.searchParams.get(wrapper);
        if (target && (target.includes('shopee.com.br') || target.startsWith('/'))) {
          // Se for um path relativo, reconstrói com o host original
          if (target.startsWith('/')) {
            currentUrl = `https://shopee.com.br${target}`;
          } else {
            currentUrl = target;
          }
          extracted = true;
          break;
        }
      }
      
      if (!extracted) break;
    }

    // 2. Limpar parâmetros de rastreio da URL final
    const finalParsed = new URL(currentUrl);
    
    // Remover parâmetros de afiliado conhecidos
    SHOPEE_AFFILIATE_PARAMS.forEach(param => {
      finalParsed.searchParams.delete(param);
    });

    // 3. Especialização para voucher-wallet
    // Se for voucher-wallet, garantir que parâmetros essenciais como 'type' e 'sort' sejam mantidos se existirem,
    // mas remover lixo.
    if (finalParsed.pathname.includes('voucher-wallet')) {
      // Atualmente mantemos o que sobrou após o filtro de afiliados
    }

    // 4. Limpeza de fragmentos (hash)
    finalParsed.hash = '';

    // 5. Normalização de domínio (garantir shopee.com.br)
    if (finalParsed.hostname === 'shopee.com' && !finalParsed.pathname.startsWith('/br')) {
      // Shopee Global redireciona, mas preferimos forçar o BR se detectarmos
    }

    return finalParsed.toString();
  } catch (err) {
    // Se falhar o parsing, retorna a original (segurança)
    return url;
  }
}

/**
 * Verifica se uma URL é Shopee.
 */
export function isShopeeUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes('shopee.com.br') || 
         lower.includes('shope.ee') || 
         lower.includes('br.shp.ee') ||
         lower.includes('s.shopee.com.br');
}
