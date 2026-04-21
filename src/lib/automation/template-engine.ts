// src/lib/automation/template-engine.ts
import { FactualData } from '../linkProcessor';

/**
 * Preenche um template de mensagem com dados factuais do produto.
 * Placeholders suportados:
 * - {{titulo}}
 * - {{preco}}
 * - {{pix}}
 * - {{link}}
 * - {{loja}}
 * - {{comissao_percentual}}
 * - {{comissao_valor}}
 * - {{categoria}}
 * - {{grupo_origem}}
 */
export function fillTemplate(template: string, data: FactualData, sourceName?: string): string {
  if (!template) return '';

  // 1. Definição dos valores (com Trava Factual no Pix)
  const placeholders: Record<string, string> = {
    '{{titulo}}': data.title || '',
    '{{preco}}': data.priceFormatted || '',
    '{{pix}}': data.pixDisplayEligible ? (data.estimatedPixPriceFormatted || '') : '',
    '{{link}}': data.finalLinkToSend || '',
    '{{loja}}': data.shopName || '',
    '{{comissao_percentual}}': data.commissionRatePercent || '',
    '{{comissao_valor}}': data.commissionValueFormatted || '',
    '{{categoria}}': (data as any).category || 'Oferta',
    '{{grupo_origem}}': sourceName || 'Fonte Monitorada'
  };

  let result = template;
  
  // 2. Substituição Determinística
  Object.entries(placeholders).forEach(([key, value]) => {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escapedKey, 'g'), value);
  });

  // 3. Limpeza Final (SEGURANÇA COMERCIAL)
  // Remove placeholders remanescentes que não foram mapeados
  result = result.replace(/\{\{[a-z0-9_]+\}\}/gi, '');

  // Remove linhas órfãs de labels comuns de preço se ficarem sem valor (ex: "Pix: ", "🔥 Por: ")
  // Regex: Linha que contém apenas labels conhecidas seguidas de nada ou espaços
  const widowLabels = /^(?:Pix:|Por:|De:|🔥 Por:|💥 Por:)\s*$/gmi;
  result = result.replace(widowLabels, '');

  // Normalização de quebras de linha múltiplas e espaços brancos
  return result.replace(/\n{3,}/g, '\n\n').trim();
}
