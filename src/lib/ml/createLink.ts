import { MLSessionSnapshot } from './vault';

export interface CreateLinkResult {
  success:    boolean;
  short_url:  string | null;
  error_code: string | null;
}

export async function generateMeliShortLink(opts: {
  canonicalUrl:    string;
  tag:             string;
  sessionSnapshot: MLSessionSnapshot;
}): Promise<CreateLinkResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch('https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Accept':        'application/json, text/plain, */*',
        'Origin':        'https://www.mercadolivre.com.br',
        'Referer':       'https://www.mercadolivre.com.br/afiliados/linkbuilder',
        'User-Agent':    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'x-csrf-token':  opts.sessionSnapshot.csrf_token,
        'Cookie':        opts.sessionSnapshot.cookie_string
      },
      body: JSON.stringify({
        urls: [opts.canonicalUrl],
        tag: opts.tag
      }),
      signal: controller.signal
    });

    if (response.ok) {
      const data = await response.json();
      const shortUrl = data?.urls?.[0]?.short_url;
      const created = data?.urls?.[0]?.created;

      if (shortUrl && created === true) {
        const result = { success: true, short_url: shortUrl, error_code: null };
        console.log('[CREATE-LINK] resultado: success');
        return result;
      }
      
      const result = { success: false, short_url: null, error_code: 'ml_no_short_url' };
      console.log('[CREATE-LINK] resultado:', result.error_code);
      return result;
    }

    let errorCode = `ml_http_${response.status}`;
    if (response.status === 401 || response.status === 403) {
      errorCode = 'ml_unauthorized';
    } else if (response.status === 429) {
      errorCode = 'ml_rate_limited';
    }

    const result = { success: false, short_url: null, error_code: errorCode };
    console.log('[CREATE-LINK] resultado:', result.error_code);
    return result;

  } catch (err: any) {
    const result = { success: false, short_url: null, error_code: 'ml_network_error' };
    console.log('[CREATE-LINK] resultado:', result.error_code);
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}
