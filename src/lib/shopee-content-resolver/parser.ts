
/**
 * Parser para extrair blocos de conteúdo da Shopee de um texto bruto.
 * Identifica grupos de mensagens (Título + Código + Link + Disclaimer) 
 * e os separa em itens individuais para processamento.
 */

export function parseShopeeContentBlocks(text: string): string[] {
  if (!text || !text.trim()) return [];

  const lines = text.split('\n');
  const blocks: string[] = [];
  let currentBlockLines: string[] = [];
  let hasLinkInCurrentBlock = false;

  // Padrões de início FORTES
  const startKeywords = [
    '🔥', 
    'CUPOM SHOPEE LIBERADO', 
    'OFERTA',
    'ACHADINHO',
    '---'
  ];

  // Padrões de início MAIS FRACOS (só iniciam se já tivermos um link no bloco anterior)
  const secondaryStartKeywords = [
    'CUPOM',
    '🎟️', 
    '✨',
    'LINK'
  ];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      if (currentBlockLines.length > 0) {
        currentBlockLines.push(line);
      }
      continue;
    }

    const isLink = /shopee\.com\.br|s\.shopee|br\.shp\.ee/.test(trimmedLine);
    const upperLine = trimmedLine.toUpperCase();
    const isStrongStart = startKeywords.some(kw => upperLine.includes(kw));
    const isSecondaryStart = secondaryStartKeywords.some(kw => upperLine.includes(kw));
    const isDisclaimer = trimmedLine.includes('⚠️') || upperLine.includes('DISPONIBILIDADE');

    // Decisão de quebra de bloco:
    // 1. Encontramos um início forte (e o bloco atual não está vazio)
    // 2. Encontramos um link e o bloco atual já tinha um link
    // 3. Encontramos um início secundário e o bloco atual já tinha um link
    const shouldSplit = (isStrongStart && currentBlockLines.length > 0) ||
                        (isLink && hasLinkInCurrentBlock) ||
                        (isSecondaryStart && hasLinkInCurrentBlock);

    if (shouldSplit && !isDisclaimer) {
      const blockText = currentBlockLines.join('\n').trim();
      if (blockText) {
        blocks.push(blockText);
      }
      currentBlockLines = [];
      hasLinkInCurrentBlock = false;
    }

    currentBlockLines.push(line);
    if (isLink) {
      hasLinkInCurrentBlock = true;
    }
  }

  // Adicionar o último bloco
  const lastBlock = currentBlockLines.join('\n').trim();
  if (lastBlock) {
    // Evitar salvar apenas disclaimer solto no fim
    const isOnlyDisclaimer = lastBlock.startsWith('⚠️') && lastBlock.length < 100;
    if (isOnlyDisclaimer && blocks.length > 0) {
      blocks[blocks.length - 1] += '\n' + lastBlock;
    } else {
      blocks.push(lastBlock);
    }
  }

  return blocks;
}
