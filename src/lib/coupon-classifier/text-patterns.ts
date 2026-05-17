
/**
 * Palavras que geralmente indicam um produto e NÃO devem ser tratadas como código de cupom.
 */
export const GENERIC_PRODUCT_WORDS = [
  'MASSAGEADOR', 'SILICONE', 'COOKTOP', 'BOLSA', 'PERFUME', 'PANINI', 
  'INFANTIL', 'FEMININA', 'MASCULINO', 'OFICIAL', 'KIT', 'JOGO', 
  'CONJUNTO', 'UNIDADES', 'PEÇAS', 'PECAS', 'ESCOVA', 'TENIS', 'TÊNIS',
  'SAPATO', 'CAMISA', 'CALÇA', 'VESTIDO', 'MAQUIAGEM', 'COZINHA', 'CASA',
  'CUPOM', 'SHOPEE', 'LIBERADO', 'RESGATE', 'AQUI', 'OFERTA', 'DESCONTO', 
  'PRODUTOS', 'FULL', 'BICICLETA'
];

/**
 * Padrões de preço FORTES de PRODUTO (De: R$, Por: R$, 🔥 Por:)
 */
export const STRONG_PRODUCT_PRICE_PATTERNS = [
  /de:\s*r\$/i,
  /por:\s*r\$/i,
  /🔥\s*por:\s*r\$/i,
  /apenas\s*r\$/i,
  /no\s*pix/i,
  /valor:\s*r\$/i
];

/**
 * Padrões de parcelamento FORTES de PRODUTO (12x de R$, sem juros)
 */
export const STRONG_PRODUCT_INSTALLMENT_PATTERNS = [
  /\d+x\s*de\s*r\$/i,
  /sem\s*juros/i,
  /parcelado/i
];

/**
 * Padrões de benefício de CUPOM (OFF, % de desconto, compras acima de)
 */
export const STRONG_COUPON_BENEFIT_PATTERNS = [
  /\d+%\s*off/i,
  /r\$\s*\d+\s*off/i,
  /compras\s*acima\s*de\s*r\$/i,
  /mínimo\s*de\s*r\$/i,
  /cupom\s*de\s*r\$/i,
  /voucher\s*de/i
];

/**
 * Padrões de cupom (Código: XXX, Cupom: XXX)
 * REFINADO: Prioridade absoluta para Código: ou Cupom: seguido de marcador claro.
 * Suporta markdown (*, **, _, ~, `)
 */
export const COUPON_PATTERNS = [
  // 1. Código: XYZ (Prioridade máxima)
  /(?:c[óo]digo)\s*[:：-]\s*[*_`~]*([A-Z0-9][A-Z0-9_-]{3,25})[*_`~]*/i,
  
  // 2. Cupom: XYZ (Só se tiver marcador claro :)
  /(?:cupom)\s*[:：-]\s*[*_`~]*([A-Z0-9][A-Z0-9_-]{3,25})[*_`~]*/i,
  
  // 3. Frases de uso explícito
  /(?:use|usar|digite|aplique|código)\s+(?:o\s+)?(?:cupom\s+|código\s+)[*_`~]*([A-Z0-9][A-Z0-9_-]{3,25})[*_`~]*/i,
  
  // 4. Padrão "Use XXX" (Menos prioritário)
  /(?:use|utilize)\s+o\s+[*_`~]*([A-Z0-9][A-Z0-9_-]{5,25})[*_`~]*/i
];
