import { canonicalizeShopeeUrl as advancedCanonicalize } from '../marketplaces/shopee/url-canonicalizer';

export async function resolveShopeeUrl(url: string, maxRedirects = 10): Promise<{ resolvedUrl: string, chain: string[], canonicalUrl: string }> {
  let currentUrl = url;
  const chain = [url];
  let redirects = 0;
  const MAX_RETRIES = 1;
  const TIMEOUT_MS = 5000;

  const isShortLink = currentUrl.includes('s.shopee.com.br') || currentUrl.includes('br.shp.ee');

  if (isShortLink) {
    while (redirects < maxRedirects) {
      let attempts = 0;
      let success = false;
      let lastError: any = null;

      while (attempts <= MAX_RETRIES && !success) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
          const res = await fetch(currentUrl, {
            method: 'GET',
            redirect: 'manual',
            signal: controller.signal
          });

          clearTimeout(timeout);
          success = true;

          // Redirect status codes: 301, 302, 303, 307, 308
          if (res.status >= 300 && res.status < 400) {
            const location = res.headers.get('location');
            if (location) {
              const nextUrl = new URL(location, currentUrl).toString();
              if (chain.includes(nextUrl)) break; // Evita loop infinito
              currentUrl = nextUrl;
              chain.push(currentUrl);
              redirects++;
              continue;
            }
          }
          // Se não for redirect, saímos do loop de redirects
          break;

        } catch (error: any) {
          clearTimeout(timeout);
          attempts++;
          lastError = error;

          if (attempts <= MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }

      if (!success) {
        throw new Error(`Failed to resolve short link after retries: ${lastError?.message || 'Unknown error'}`);
      }
      
      // Sai do loop while(redirects) se a request foi sucesso e não foi redirect
      break; 
    }
  }

  const canonicalUrl = await canonicalizeShopeeUrl(currentUrl);

  return { resolvedUrl: currentUrl, chain, canonicalUrl };
}

/**
 * Limpa a URL e normaliza o formato Shopee.
 */
async function canonicalizeShopeeUrl(url: string): Promise<string> {
  try {
    // 1. Tentar extrair IDs primeiro para canonicalização agressiva de produtos
    const { shopId, itemId } = extractIds(url);

    if (shopId && itemId) {
      return `https://shopee.com.br/product/${shopId}/${itemId}`;
    }

    // 2. Usar o canonicalizer avançado
    return advancedCanonicalize(url);
  } catch {
    return url;
  }
}

export function extractIds(url: string) {
  // 1. Padrão slug-i.shopId.itemId
  const legacyMatch = url.match(/-i\.(\d+)\.(\d+)/);
  if (legacyMatch) return { shopId: legacyMatch[1], itemId: legacyMatch[2] };

  // 2. Padrão /product/shopId/itemId
  const productMatch = url.match(/\/product\/(\d+)\/(\d+)/);
  if (productMatch) return { shopId: productMatch[1], itemId: productMatch[2] };

  // 3. Padrão /{slug}/{shopId}/{itemId}
  const slugIdMatch = url.match(/\/([^\/?]+)\/(\d+)\/(\d+)/);
  if (slugIdMatch) return { shopId: slugIdMatch[2], itemId: slugIdMatch[3] };

  return { shopId: null, itemId: null };
}
