export const ML_DOMAINS = [
  'mercadolivre.com.br',
  'mercadolibre.com',
  'meli.com',
  'mercadol.in'
];

export function selectShortLinkInputUrl(opts: {
  resolved_url?:  string | null;
  incoming_url?:  string | null;
  canonical_url?: string | null;
}): string | null {
  const isMlDomain = (url: string) => {
    return ML_DOMAINS.some(domain => url.includes(domain));
  };

  if (opts.resolved_url && opts.resolved_url.trim() !== '' && isMlDomain(opts.resolved_url)) {
    return opts.resolved_url;
  }

  if (opts.incoming_url && opts.incoming_url.trim() !== '' && isMlDomain(opts.incoming_url)) {
    return opts.incoming_url;
  }

  if (opts.canonical_url && opts.canonical_url.trim() !== '') {
    return opts.canonical_url;
  }

  return null;
}
