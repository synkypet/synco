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
  timeoutMs = 4000,
  candidateKind = 'unknown'
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
  
  let diagReason = 'none';
  let htmlLength = 0;
  let hasTitleTag = false, hasOgTitle = false, hasOgImage = false, hasJsonLd = false, hasNextData = false, hasPreloadedState = false, hasMlstatic = false, hasPriceLikePattern = false, botDetected = false;
  let status = 0;

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal
    });

    clearTimeout(timer);
    status = response.status;

    if (!response.ok) {
      diagReason = `http_error_${response.status}`;
      throw new Error(`HTTP status ${response.status}`);
    }

    const html = await response.text();
    htmlLength = html.length;

    hasTitleTag = /<title[^>]*>/i.test(html);
    hasOgTitle = /og:title/i.test(html);
    hasOgImage = /og:image/i.test(html);
    hasJsonLd = /application\/ld\+json/i.test(html);
    hasNextData = /__NEXT_DATA__/i.test(html);
    hasPreloadedState = /__PRELOADED_STATE__/i.test(html);
    hasMlstatic = /http2?:\/\/http2\.mlstatic\.com/i.test(html);
    hasPriceLikePattern = /"price":|meta itemprop="price"|"current_price":/i.test(html);
    // ML pode servir HTML parcial útil abaixo de 50KB
    botDetected = html.includes('captcha') || html.includes('sec-challenge') || html.includes('Verifique se você é humano') || html.includes('validate') || html.includes('Please verify you are a human') || html.includes('px-captcha') || html.length < 20000;

    if (botDetected) {
      diagReason = 'bot_or_shell';
    }

    // 1. Tentar extração via JSON-LD (application/ld+json)
    try {
      const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      for (const match of jsonLdMatches) {
        const jsonContent = match[1].trim();
        try {
          const parsed = JSON.parse(jsonContent);
          
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
        const stateScripts = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
        for (const match of stateScripts) {
          const scriptText = match[1];
          if (scriptText.includes('window.__PRELOADED_STATE__') || scriptText.includes('__NEXT_DATA__') || scriptText.includes('initialState')) {
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
                      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (h1Match) {
        let t = decodeHTMLEntities(h1Match[1].replace(/<[^>]*>/g, '').trim());
        t = t.replace(/\s*\|.*$/, '').replace(/\s*-.*$/, '').replace(/Mercado Livre Brasil/i, '').replace(/Mercado Livre/i, '').trim();
        result.title = t;
        result.titleSource = "html_regex";
      }
    }

    if (!result.imageUrl) {
      const twImage = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
      if (twImage) {
        result.imageUrl = decodeHTMLEntities(twImage[1].trim());
        result.imageSource = "twitter_image";
      }
    }

    if (!result.imageUrl) {
      const imgTagMatch = html.match(/<img[^>]*class=["'][^"']*ui-pdp-gallery__figure__image[^"']*["'][^>]*src=["']([^"']+)["']/i) ||
                          html.match(/<img[^>]*data-zoom=["']([^"']+)["']/i);
      if (imgTagMatch) {
        result.imageUrl = decodeHTMLEntities(imgTagMatch[1].trim());
        result.imageSource = "html_regex";
      }
    }

    if (!result.imageUrl) {
      const staticImg = html.match(/https?:\/\/http2\.mlstatic\.com\/D_[A-Za-z0-9_-]+\.(jpg|jpeg|webp|png)/i);
      if (staticImg) {
        result.imageUrl = staticImg[0].replace(/\\u002F/g, '/');
        result.imageSource = "html_regex_mlstatic";
      }
    }

    if (result.imageUrl && result.imageUrl.startsWith('//')) {
      result.imageUrl = 'https:' + result.imageUrl;
    }
    
    if (!result.price) {
      const andesMatch = html.match(/class=["'][^"']*andes-money-amount__fraction[^"']*["'][^>]*>([\d.,]+)<\//i);
      if (andesMatch) {
        const val = parseFloat(andesMatch[1].replace(/\./g, '').replace(',', '.'));
        if (!isNaN(val) && val > 0) {
          result.price = val;
          result.priceSource = "html_andes";
        }
      }
    }
    
    if (result.title || result.imageUrl || result.price) {
      if (diagReason === 'none' || diagReason === 'bot_or_shell') {
        diagReason = 'success_partial_or_full';
      }
    }

  } catch (error: any) {
    clearTimeout(timer);
    if (!diagReason || diagReason === 'none') {
      diagReason = error.name === 'AbortError' ? 'timeout' : 'fetch_error';
    }
    console.warn(`[ML-METADATA-PIPELINE] Static HTML extract failed or timed out: ${error.message}`);
  }

  console.info('[ML-STATIC-DIAG]', {
    candidateKind,
    status,
    htmlLength,
    hasTitleTag,
    hasOgTitle,
    hasOgImage,
    hasJsonLd,
    hasNextData,
    hasPreloadedState,
    hasMlstatic,
    hasPriceLikePattern,
    botDetected,
    extractionReason: diagReason,
    extractedTitle: !!result.title,
    extractedImage: !!result.imageUrl,
    extractedPrice: !!result.price
  });

  return result;
}
