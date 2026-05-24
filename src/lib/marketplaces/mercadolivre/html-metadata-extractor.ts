import { ProductMetadata } from '../BaseAdapter';

/**
 * Decodifica entidades HTML básicas (ex: &amp;, &quot;, &#39;, &lt;, &gt;, &nbsp;)
 */
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\\u002F/g, '/')
    .replace(/\\u0022/g, '"')
    .replace(/\\u0027/g, "'");
}

interface ExtractedMetadata {
  title: string | null;
  price: number | null;
  originalPrice: number | null;
  imageUrl: string | null;
  priceSource: string | null;
  titleSource: string | null;
  imageSource: string | null;
}

/**
 * Extrator rápido de metadados estáticos de páginas HTML do Mercado Livre.
 * Executa fetch direto com timeout curto e parse estruturado via regex e JSON-LD.
 */
export async function extractMLStaticMetadata(
  url: string,
  timeoutMs = 4000
): Promise<ExtractedMetadata> {
  const result: ExtractedMetadata = {
    title: null,
    price: null,
    originalPrice: null,
    imageUrl: null,
    priceSource: null,
    titleSource: null,
    imageSource: null,
  };

  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const headers = {
    "User-Agent": userAgent,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache"
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`HTTP status ${response.status}`);
    }

    const html = await response.text();

    // 1. Tentar extração via JSON-LD (application/ld+json)
    try {
      const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      for (const match of jsonLdMatches) {
        const jsonContent = match[1].trim();
        try {
          const parsed = JSON.parse(jsonContent);
          
          // Verificar se é um schema de Product ou uma lista contendo Product
          const extractFromProduct = (obj: any) => {
            if (obj && (obj["@type"] === "Product" || obj["type"] === "Product")) {
              if (obj.name && !result.title) {
                result.title = decodeHTMLEntities(obj.name);
                result.titleSource = "json_ld";
              }
              if (obj.image && !result.imageUrl) {
                result.imageUrl = typeof obj.image === 'string' ? obj.image : (Array.isArray(obj.image) ? obj.image[0] : null);
                result.imageSource = "json_ld";
              }
              if (obj.offers) {
                const offers = Array.isArray(obj.offers) ? obj.offers[0] : obj.offers;
                if (offers.price) {
                  const parsedPrice = parseFloat(offers.price);
                  if (!isNaN(parsedPrice) && parsedPrice > 0 && !result.price) {
                    result.price = parsedPrice;
                    result.priceSource = "json_ld";
                  }
                }
              }
            }
          };

          if (Array.isArray(parsed)) {
            parsed.forEach(extractFromProduct);
          } else {
            extractFromProduct(parsed);
          }
        } catch {
          // Ignorar erros de parse JSON individual
        }
      }
    } catch (e) {
      // Ignorar erros no parser JSON-LD geral
    }

    // 2. Tentar extração via Open Graph tags
    if (!result.title) {
      const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
      if (ogTitle) {
        result.title = decodeHTMLEntities(ogTitle[1].trim());
        result.titleSource = "og";
      }
    }

    if (!result.imageUrl) {
      const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
      if (ogImage) {
        result.imageUrl = decodeHTMLEntities(ogImage[1].trim());
        result.imageSource = "og";
      }
    }

    if (!result.price) {
      const ogPrice = html.match(/<meta[^>]*property=["']product:price:amount["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']product:price:amount["']/i);
      if (ogPrice) {
        const parsedPrice = parseFloat(ogPrice[1]);
        if (!isNaN(parsedPrice) && parsedPrice > 0) {
          result.price = parsedPrice;
          result.priceSource = "og";
        }
      }
    }

    // 3. Tentar extração via Hydrated / State JSON de scripts internos do Mercado Livre
    if (!result.price || !result.title || !result.imageUrl) {
      try {
        // Encontrar objetos de state/configurações que contêm preço e imagens
        const stateScripts = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
        for (const match of stateScripts) {
          const scriptText = match[1];
          if (scriptText.includes('window.__PRELOADED_STATE__') || scriptText.includes('__NEXT_DATA__') || scriptText.includes('initialState')) {
            // Tentar extrair propriedades via Regex rápida
            if (!result.price) {
              const priceMatch = scriptText.match(/"price"\s*:\s*([0-9.]+)/) || 
                                 scriptText.match(/"current_price"\s*:\s*([0-9.]+)/) ||
                                 scriptText.match(/"amount"\s*:\s*([0-9.]+)/);
              if (priceMatch) {
                const parsedPrice = parseFloat(priceMatch[1]);
                if (!isNaN(parsedPrice) && parsedPrice > 0) {
                  result.price = parsedPrice;
                  result.priceSource = "hydration_json";
                }
              }
            }

            if (!result.title) {
              const titleMatch = scriptText.match(/"title"\s*:\s*"([^"]+)"/) ||
                                 scriptText.match(/"name"\s*:\s*"([^"]+)"/);
              if (titleMatch) {
                result.title = decodeHTMLEntities(titleMatch[1]);
                result.titleSource = "hydration_json";
              }
            }

            if (!result.imageUrl) {
              const imgMatch = scriptText.match(/"secure_url"\s*:\s*"([^"]+)"/) ||
                               scriptText.match(/"thumbnail"\s*:\s*"([^"]+)"/) ||
                               scriptText.match(/"picture"\s*:\s*"([^"]+)"/);
              if (imgMatch) {
                result.imageUrl = decodeHTMLEntities(imgMatch[1]);
                result.imageSource = "hydration_json";
              }
            }
          }
        }
      } catch {
        // Ignorar erros de parse do hydrated script
      }
    }

    // 4. Regex direta no HTML textual como fallback de salvaguarda
    if (!result.title) {
      const h1Match = html.match(/<h1[^>]*class=["'][^"']*ui-pdp-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) ||
                      html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
                      html.match(/<title>([\s\S]*?)<\/title>/i);
      if (h1Match) {
        result.title = decodeHTMLEntities(h1Match[1].replace(/<[^>]*>/g, '').trim());
        result.titleSource = "html_regex";
      }
    }

    if (!result.imageUrl) {
      // Procurar por tags de imagem estruturadas do Mercado Livre
      const imgTagMatch = html.match(/<img[^>]*class=["'][^"']*ui-pdp-gallery__figure__image[^"']*["'][^>]*src=["']([^"']+)["']/i) ||
                          html.match(/<img[^>]*data-zoom=["']([^"']+)["']/i);
      if (imgTagMatch) {
        result.imageUrl = decodeHTMLEntities(imgTagMatch[1].trim());
        result.imageSource = "html_regex";
      }
    }

    // Sanear a URL da imagem se for relativa
    if (result.imageUrl && result.imageUrl.startsWith('//')) {
      result.imageUrl = 'https:' + result.imageUrl;
    }

  } catch (error: any) {
    clearTimeout(timer);
    console.warn(`[ML-METADATA-PIPELINE] Static HTML extract failed or timed out: ${error.message}`);
  }

  return result;
}
