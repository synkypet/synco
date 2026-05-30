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

export function extractWasenderText(payloadBody: any, logPrefix: string = '[WASENDER-BODY-EXTRACT-DIAG]'): string {
  try {
    const data = payloadBody?.data || payloadBody || {};
    let m = data.messages || data;
    if (Array.isArray(m)) {
      m = m[0] || {};
    }

    const msgObj = m.message || {};
    const nestedMsgObj = msgObj.message || {};

    const candidates = {
      dataBody: data.body,
      dataText: data.text,
      dataMessageBody: data.message?.body,
      dataMessageText: data.message?.text,
      messageConversation: msgObj.conversation,
      extendedText: msgObj.extendedTextMessage?.text,
      imageCaption: msgObj.imageMessage?.caption,
      videoCaption: msgObj.videoMessage?.caption,
      documentCaption: msgObj.documentMessage?.caption,
      messageBody: m.body,
      messageText: m.text,
      nestedConversation: nestedMsgObj.conversation,
      nestedExtendedText: nestedMsgObj.extendedTextMessage?.text,
      payloadBody: payloadBody?.body,
      payloadText: payloadBody?.text
    };

    const candidateLengths = Object.fromEntries(
      Object.entries(candidates).map(([key, val]) => [key, typeof val === 'string' ? val.length : 0])
    );

    const orderedKeys = [
      'dataBody', 'dataText', 'dataMessageBody', 'dataMessageText',
      'messageConversation', 'extendedText', 'imageCaption', 'videoCaption', 'documentCaption',
      'messageBody', 'messageText',
      'nestedConversation', 'nestedExtendedText',
      'payloadBody', 'payloadText'
    ];

    let selectedPath: string | null = null;
    let selectedText: string = "";

    for (const key of orderedKeys) {
      const val = (candidates as any)[key];
      if (typeof val === 'string' && val.trim().length > 0) {
        selectedPath = key;
        selectedText = val;
        break;
      }
    }

    console.log(`${logPrefix} ${JSON.stringify({
      hasData: !!payloadBody?.data,
      hasMessage: !!m.message,
      candidateLengths,
      selectedPath
    }, null, 2)}`);

    return selectedText.trim();
  } catch (error) {
    console.error(`${logPrefix} Error extracting text:`, error);
    return "";
  }
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

  // 5. Extração do Conteúdo (Texto/Legenda) - Função robusta com logs
  const body = extractWasenderText(payloadBody);

  return {
    externalGroupId: typeof externalGroupId === 'string' ? externalGroupId : "",
    messageId: typeof messageId === 'string' ? messageId : "",
    body: typeof body === 'string' ? body : "",
    isFromMe: !!isFromMe,
    participant: m.key?.participant || m.participant || undefined
  };
}
