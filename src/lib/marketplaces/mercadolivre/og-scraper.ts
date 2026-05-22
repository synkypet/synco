/**
 * Scraper simples de tags OpenGraph do Mercado Livre.
 * Busca og:title e og:image do HTML público para contornar a autenticação exigida pela API.
 */
export async function fetchOGMetadata(canonicalUrl: string): Promise<{ title: string | null, imageUrl: string | null }> {
  const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const headers = {
    "User-Agent": userAgent,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9"
  };

  const maxRetries = 1;
  const timeoutMs = 8000;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(canonicalUrl, {
        headers,
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`HTTP status ${response.status}`);
      }

      const html = await response.text();

      // Regex para capturar og:title (tenta property primeiro e depois content, ou vice-versa)
      const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
      
      // Regex para capturar og:image
      const imageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);

      const title = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : null;
      const imageUrl = imageMatch ? imageMatch[1].trim() : null;

      if (title || imageUrl) {
        return { title, imageUrl };
      }

      // Se não encontrou nenhuma das tags, lança erro para tentar o retry se disponível
      throw new Error("OG tags not found in HTML");

    } catch (error: any) {
      clearTimeout(timer);
      console.warn(`[ML-OG-SCRAPER] Attempt ${attempt} failed for ${canonicalUrl}: ${error.message}`);
      
      if (attempt > maxRetries) {
        return { title: null, imageUrl: null };
      }

      // Espera 600ms antes do retry
      await new Promise(resolve => setTimeout(resolve, 600));
    }
  }

  return { title: null, imageUrl: null };
}

/**
 * Função utilitária para decodificar entidades HTML básicas (ex: &amp;, &quot;, &lt;, &gt;, &#39;)
 */
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}
