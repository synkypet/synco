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
  
  // 1. Localizar o objeto real da mensagem
  // Wasender Deep envia as mensagens dentro de um array 'messages'
  let m = data;
  if (Array.isArray(data.messages) && data.messages.length > 0) {
    m = data.messages[0];
  } else if (Array.isArray(data) && data.length > 0) {
    m = data[0];
  }

  // Se o objeto for uma string (raro), tentamos retornar algo mínimo
  if (typeof m === 'string') {
    return {
      externalGroupId: "",
      messageId: "",
      body: m,
      isFromMe: false
    };
  }

  // 2. Extração do Identificador do Chat (Grupo ou Individual JID)
  // Prioridade para o remoteJid aninhado que é o padrão mais estável
  const rawGroupId = 
    m.key?.remoteJid || 
    m.chatId || 
    m.from || 
    m.remote_id || 
    m.jid || 
    m.remoteJid ||
    "";

  // 3. Extração do ID da Mensagem
  const rawMessageId = 
    m.key?.id || 
    m.id || 
    m.messageId || 
    "";

  // 4. Extração da Origem (FromMe)
  const isFromMe = 
    m.key?.fromMe ?? 
    m.isFromMe ?? 
    false;

  // 5. Extração do Conteúdo (Texto/Legenda) - Prioridade para o objeto 'message' aninhado
  const c = m.message || m;
  
  const rawBody = 
    c.conversation || 
    c.extendedTextMessage?.text || 
    c.imageMessage?.caption || 
    c.videoMessage?.caption || 
    c.documentWithCaptionMessage?.message?.documentMessage?.caption ||
    c.body || 
    c.content || 
    c.text || 
    "";

  return {
    externalGroupId: typeof rawGroupId === 'string' ? rawGroupId : "",
    messageId: typeof rawMessageId === 'string' ? rawMessageId : "",
    body: typeof rawBody === 'string' ? rawBody : "",
    isFromMe: !!isFromMe,
    participant: m.key?.participant || m.participant || undefined
  };
}
