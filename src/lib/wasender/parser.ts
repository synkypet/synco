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

interface StringCandidate {
  path: string;
  length: number;
  hasUrl: boolean;
  preview: string;
  _rawValue: string;
}

function collectStringCandidates(obj: any, maxDepth = 6, currentDepth = 0, currentPath = 'root', candidates: StringCandidate[] = []): StringCandidate[] {
  if (currentDepth > maxDepth || !obj || typeof obj !== 'object') {
    return candidates;
  }

  const sensitiveKeys = ['signature', 'token', 'authorization', 'secret', 'cookie', 'credential', 'headers'];

  for (const [k, v] of Object.entries(obj)) {
    const keyLower = k.toLowerCase();
    
    if (sensitiveKeys.includes(keyLower)) {
      continue;
    }

    const path = `${currentPath}.${k}`;

    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed.length > 0) {
        let preview = trimmed.substring(0, 120).replace(/\r?\n|\r/g, ' ');
        preview = preview.replace(/\d{5,}/g, '***'); // Reduz números longos

        candidates.push({
          path,
          length: trimmed.length,
          hasUrl: /(https?:\/\/|meli\.la|s\.shopee|mercadolivre|shopee)/i.test(trimmed),
          preview,
          _rawValue: trimmed
        });
      }
    } else if (typeof v === 'object' && v !== null) {
      collectStringCandidates(v, maxDepth, currentDepth + 1, path, candidates);
    }
  }

  return candidates.slice(0, 25);
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
      nestedImageCaption: nestedMsgObj.imageMessage?.caption,
      nestedVideoCaption: nestedMsgObj.videoMessage?.caption,
      nestedDocumentCaption: nestedMsgObj.documentMessage?.caption,
      nestedButtonsSelectedText: nestedMsgObj.buttonsResponseMessage?.selectedDisplayText,
      nestedTemplateSelectedText: nestedMsgObj.templateButtonReplyMessage?.selectedDisplayText,
      nestedListTitle: nestedMsgObj.listResponseMessage?.title,
      nestedListDesc: nestedMsgObj.listResponseMessage?.description,
      payloadMessageConversation: payloadBody?.payload?.message?.conversation,
      payloadMessageExtendedText: payloadBody?.payload?.message?.extendedTextMessage?.text,
      dataMessageTextMessage: data.message?.textMessage?.text,
      nestedTextMessage: nestedMsgObj.textMessage?.text,
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
      'nestedConversation', 'nestedExtendedText', 'nestedImageCaption', 'nestedVideoCaption', 'nestedDocumentCaption',
      'nestedButtonsSelectedText', 'nestedTemplateSelectedText', 'nestedListTitle', 'nestedListDesc',
      'payloadMessageConversation', 'payloadMessageExtendedText', 'dataMessageTextMessage', 'nestedTextMessage',
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

    if (selectedPath) {
      console.log(`${logPrefix} ${JSON.stringify({
        hasData: !!payloadBody?.data,
        hasMessage: !!m.message,
        candidateLengths,
        selectedPath
      }, null, 2)}`);
      return selectedText.trim();
    }

    // Diagnóstico Seguro e Auto-Recovery
    const stringCands = collectStringCandidates(payloadBody);
    console.log(`[WASENDER-PAYLOAD-SHAPE-DIAG] ${JSON.stringify({
      event: payloadBody?.event || payloadBody?.type,
      payloadKeys: Object.keys(payloadBody || {}),
      dataKeys: Object.keys(data || {}),
      messageKeys: Object.keys(m || {}),
      nestedMessageKeys: Object.keys(msgObj || {}),
      dataType: typeof data,
      messageType: typeof m,
      pushNameExists: !!m.pushName,
      remoteJid: m.key?.remoteJid ? m.key.remoteJid.replace(/\d{5,}/g, '***') : null,
      fromMe: m.key?.fromMe,
      stringCandidates: stringCands.map(c => ({ path: c.path, length: c.length, hasUrl: c.hasUrl, preview: c.preview }))
    }, null, 2)}`);

    const urlCandidate = stringCands.find(c => c.hasUrl);
    if (urlCandidate) {
      console.log(`${logPrefix} Auto-recovered from path: ${urlCandidate.path}`);
      return urlCandidate._rawValue.trim();
    }

    return "";
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
