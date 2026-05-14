import { FactualData } from '../linkProcessor';
import { buildSmartContext, renderSmartTemplate } from '../templates/universal-template-engine';

/**
 * Preenche um template de mensagem com dados factuais do produto.
 * Usa o motor universal para garantir segurança factual.
 */
export function fillTemplate(template: string, data: FactualData, sourceName?: string): string {
  if (!template) return '';
  
  const context = buildSmartContext(data, sourceName);
  return renderSmartTemplate(template, context);
}
