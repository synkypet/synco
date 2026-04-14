/**
 * Utilitário de Parsing para Webhooks Wasender
 * Centraliza a extração de metadados de mensagens para lidar com as variações 
 * de payload da Wasender (Deep Arrays, Nested Keys, Media Captions).
 */

export interface WebhookMessageContext {
  externalGroupId: string;
  messageId: string;
  body: string;
  isFromMe: boolean;
  participant?: string;
}

/**
 * Extrai o contexto de uma mensagem de forma defensiva e resiliente.
 * Tenta progressivamente localizar o ID do chat, o conteúdo e o ID da mensagem.
 */
export function extractWebhookMessageContext(payloadBody: any): WebhookMessageContext {
  // Garantir que estamos olhando para o objeto de dados
  const data = payloadBody.data || payloadBody;
  
  // 1. Localizar o objeto real da mensagem (Wasender Deep pode ser Array ou Objeto Único)
  let m = data.messages || data;
  if (Array.isArray(m)) {
    m = m[0] || {};
  }

  // Fallback: se o objeto for string (raro), tratamos como corpo
  if (typeof m === 'string') {
    return { externalGroupId: "", messageId: "", body: m, isFromMe: false };
  }

  // 2. Extração do Identificador do Chat (Apenas Grupos @g.us)
  // Prioridades: m.key.remoteJid -> data.remoteJid
  const groupCandidates = [
    m.key?.remoteJid,
    data.remoteJid,
    m.chatId,
    m.from,
    m.jid
  ];
  
  // Regra de segurança: Deve terminar com @g.us para ser considerado grupo de origem
  const externalGroupId = groupCandidates.find(id => typeof id === 'string' && id.endsWith('@g.us')) || "";

  // 3. Extração do ID da Mensagem
  // Prioridades: m.key.id -> data.id
  const messageId = 
    m.key?.id || 
    data.id || 
    m.id || 
    "";

  // 4. Extração da Origem (FromMe)
  const isFromMe = 
    m.key?.fromMe ?? 
    m.isFromMe ?? 
    false;

  // 5. Extração do Conteúdo (Texto/Legenda) - Prioridade total para o objeto 'message' aninhado
  const msgObj = m.message || {};
  
  const bodyCandidates = [
    msgObj.extendedTextMessage?.text,
    data.messageBody,
    msgObj.conversation,
    msgObj.imageMessage?.caption,
    msgObj.videoMessage?.caption,
    m.body,
    m.content,
    m.text
  ];

  const body = bodyCandidates.find(b => typeof b === 'string' && b.length > 0) || "";

  return {
    externalGroupId: typeof externalGroupId === 'string' ? externalGroupId : "",
    messageId: typeof messageId === 'string' ? messageId : "",
    body: typeof body === 'string' ? body : "",
    isFromMe: !!isFromMe,
    participant: m.key?.participant || m.participant || undefined
  };
}
