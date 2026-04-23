// src/lib/marketplaces/shopee/cleaner.ts

/**
 * Utilitário de limpeza de títulos para posts de afiliados.
 * Remove emojis, termos de busca e tags promocionais agressivas.
 */
export function cleanProductName(name: string): string {
  if (!name) return '';

  let clean = name;

  // 1. Remover Emojis e Símbolos Específicos
  // Regex para emojis e caracteres suplementares
  clean = clean.replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');

  // 2. Remover Prefixos de Status/Promocionais comuns com colchetes ou aspas
  const boilerplatePatterns = [
    /\[.*?\]/g,          // Remove qualquer coisa dentro de colchetes: [ENVIO RAPIDO], [PROMO]
    /\(.*?\)/g,          // Remove qualquer coisa dentro de parênteses: (ORIGINAL), (PROMOÇÃO)
    /【.*?】/g,          // Parênteses asiáticos comuns na Shopee
    /\{.*?\}/g,          // Chaves
    /🔥/g, /✅/g, /🚀/g, /✨/g, /⭐/g, /💎/g, /⚡/g, /📦/g, /🛒/g, /💯/g,
    /OFERTA/gi,
    /PROMOÇÃO/gi,
    /ENVIO IMEDIATO/gi,
    /ENVIO RÁPIDO/gi,
    /PRONTA ENTREGA/gi,
    /MELHOR PREÇO/gi,
    /BARATO/gi,
    /PREÇO BAIXO/gi,
    /FRETE GRÁTIS/gi,
    /ORIGINAL/gi,
    /LANÇAMENTO/gi,
    /ESTOQUE NO BRASIL/gi,
    /PRODUTO NO BRASIL/gi,
  ];

  boilerplatePatterns.forEach(pattern => {
    clean = clean.replace(pattern, '');
  });

  // 3. Remover sufixos de Marketplace
  clean = clean.replace(/Shopee Brasil/gi, '');
  clean = clean.replace(/Shopee BR/gi, '');

  // 4. Limpeza Final de Espaços e Caracteres Especiais Órfãos
  clean = clean
    .replace(/[*\-_=|]/g, ' ') // Remove divisores comuns
    .replace(/\s\s+/g, ' ')    // Remove espaços duplos
    .trim();

  // 5. Deduplicação de palavras adjacentes (ex: "Fone Fone Bluetooth")
  const words = clean.split(' ');
  const uniqueWords = words.filter((word, index) => {
    return index === 0 || word.toLowerCase() !== words[index - 1].toLowerCase();
  });
  clean = uniqueWords.join(' ');

  // 6. Capitalização: Forçar primeira letra maiúscula e manter o resto (Shopee costuma usar Título Case)
  if (clean.length > 0) {
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  return clean || name; // Fallback para o nome original se a limpeza for agressiva demais
}
