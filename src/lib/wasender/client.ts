import { WasenderSessionStatus } from '@/types/group';

export class WasenderClient {
  private static get baseURL() {
    return process.env.WASENDER_API_URL || 'https://wasenderapi.com/api';
  }

  private static get pat() {
    return process.env.WASENDER_PAT;
  }

  private static getHeaders(apiKey?: string) {
    let finalKey = '';
    let source = 'NONE';

    // 1. Prioridade: Chave da Sessão (se fornecida e válida)
    if (apiKey && !apiKey.includes(':')) {
      finalKey = apiKey;
      source = 'SESSION';
    } else if (apiKey && apiKey.includes(':')) {
      console.warn(`[WASENDER-AUTH] [${new Date().toISOString()}] Chave de sessão suspeita (formato Telegram). Ignorando e tentando fallback.`);
    }

    // 2. Fallback: PAT Global (se a chave da sessão falhou ou não existe)
    if (!finalKey && this.pat) {
      finalKey = this.pat;
      source = 'GLOBAL_PAT';
    }

    if (!finalKey) {
      console.error(`[WASENDER-AUTH] [${new Date().toISOString()}] Nenhuma credencial válida encontrada (Session ou PAT).`);
    } else {
      console.log(`[WASENDER-AUTH] [${new Date().toISOString()}] Utilizando credencial: ${source}`);
    }

    return {
      'Content-Type': 'application/json',
      'X-Api-Key': finalKey,
      'Authorization': `Bearer ${finalKey}`
    };
  }

  // ─── Session Lifecycle ──────────────────────────────────────────────────

  static async createSession(params: {
    name: string;
    phoneNumber: string;
    webhookUrl?: string;
  }) {
    const body: Record<string, any> = {
      name: params.name,
      phone_number: params.phoneNumber,
      account_protection: true,
      log_messages: true,
      read_incoming_messages: false,
    };

    // URL base do app local/remota
    const rawUrl = params.webhookUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://synco-mocha.vercel.app';
    const baseUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
    const finalWebhookUrl = baseUrl.includes('/api/webhooks/wasender') 
      ? baseUrl 
      : `${baseUrl}/api/webhooks/wasender`;

    // Regras obrigatórias do webhook
    body.webhook_url = finalWebhookUrl;
    body.webhook_enabled = true;
    body.webhook_events = [
      'session.status',
      'qrcode.updated',
      'groups.upsert',
      'groups.update',
      'group-participants.update',
      'messages.received',
      'messages-group.received',
      'message.sent',
      'messages.update'
    ];
    body.ignore_groups = false;
    body.ignore_broadcasts = true;
    body.ignore_channels = true;

    const res = await fetch(`${this.baseURL}/whatsapp-sessions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });
    
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to create Wasender session: ${err}`);
    }
    return res.json();
  }

  static async connectSession(sessionId: string) {
    const res = await fetch(`${this.baseURL}/whatsapp-sessions/${sessionId}/connect`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to connect session: ${err}`);
    }
    return res.json();
  }

  static async updateSessionWebhook(sessionId: string, apiKey?: string) {
    const rawUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://synco-mocha.vercel.app';
    const baseUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
    const finalWebhookUrl = baseUrl.includes('/api/webhooks/wasender') 
      ? baseUrl 
      : `${baseUrl}/api/webhooks/wasender`;

    const body = {
      webhook_url: finalWebhookUrl,
      webhook_enabled: true,
      webhook_events: [
        'session.status',
        'qrcode.updated',
        'groups.upsert',
        'groups.update',
        'group-participants.update',
        'messages.received',
        'messages-group.received',
        'message.sent',
        'messages.update'
      ],
      ignore_groups: false,
      ignore_broadcasts: true,
      ignore_channels: true
    };
    
    const res = await fetch(`${this.baseURL}/whatsapp-sessions/${sessionId}`, {
      method: 'PUT',
      headers: this.getHeaders(apiKey),
      body: JSON.stringify(body)
    });
    
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to update session webhook: ${err}`);
    }
    return res.json();
  }

  static async getStatus(sessionId: string, apiKey?: string) {
    const url = apiKey 
      ? `${this.baseURL}/status` 
      : `${this.baseURL}/whatsapp-sessions/${sessionId}`;

    const headers = this.getHeaders(apiKey);
    
    const res = await fetch(url, {
      method: 'GET',
      headers
    });
    
    if (!res.ok) {
        const contentType = res.headers.get('content-type');
        const errText = await res.text();
        
        if (res.status === 404) {
          throw new Error(`SESSION_NOT_FOUND: Sessão ${sessionId} não existe na Wasender API (404).`);
        }

        if (contentType?.includes('text/html')) {
          throw new Error(`WASENDER_API_OFFLINE: A Wasender retornou uma página HTML inesperada (Pode estar fora do ar ou URL incorreta). Status: ${res.status}`);
        }

        throw new Error(`Failed to get status: ${errText || res.statusText}`);
    }

    try {
      return await res.json();
    } catch (e) {
      throw new Error(`INVALID_JSON_RESPONSE: A Wasender não retornou um JSON válido.`);
    }
  }

  static async getQrCode(sessionId: string) {
    const res = await fetch(`${this.baseURL}/whatsapp-sessions/${sessionId}/qrcode`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to get QR code: ${err}`);
    }
    return res.json(); 
  }

  static async getSession(sessionId: string) {
    const res = await fetch(`${this.baseURL}/whatsapp-sessions/${sessionId}`, {
      method: 'GET',
      headers: this.getHeaders() // Usa o PAT global por padrão
    });
    
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to get session details: ${err}`);
    }
    return res.json();
  }

  static async restartSession(sessionId: string) {
    const res = await fetch(`${this.baseURL}/whatsapp-sessions/${sessionId}/restart`, {
      method: 'POST',
      headers: this.getHeaders() // Usa o PAT global
    });
    
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to restart session: ${err}`);
    }
    return res.json();
  }

  static async disconnectSession(sessionId: string) {
    console.log(`[WASENDER-CLIENT] Chamando disconnect para sessão ${sessionId}`);
    const res = await fetch(`${this.baseURL}/whatsapp-sessions/${sessionId}/disconnect`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to disconnect session: ${err}`);
    }
    return res.json();
  }

  static async deleteSession(sessionId: string) {
    console.log(`[WASENDER-CLIENT] Chamando DELETE para sessão ${sessionId}`);
    const res = await fetch(`${this.baseURL}/whatsapp-sessions/${sessionId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    
    // Ler o corpo primeiro
    const text = await res.text();
    const contentType = res.headers.get('content-type') || '';
    
    console.log(`[WASENDER-CLIENT] Resposta DELETE: status=${res.status}, contentType=${contentType}, bodyLength=${text.length}`);

    if (!res.ok) {
        throw new Error(`Failed to delete session: ${text}`);
    }

    // Se vier vazio (ex: 204 No Content ou 200 com body vazio)
    if (!text || text.trim() === '') {
        return { success: true };
    }

    // Tentar parsear JSON apenas se houver conteúdo e for JSON
    if (contentType.includes('application/json')) {
        try {
            return JSON.parse(text);
        } catch (e) {
            console.warn('[WASENDER-CLIENT] Erro ao fazer parse do corpo JSON no DELETE, tratando como sucesso.');
            return { success: true };
        }
    }

    // Para outros content types que deram sucesso, apenas retornar sucesso
    return { success: true };
  }

  static getGroupsUrl(sessionId: string) {
    return `${this.baseURL}/groups?session_id=${sessionId}`;
  }

  // ─── Groups ─────────────────────────────────────────────────────────────

  static async getGroups(sessionId: string, apiKey?: string) {
    const res = await fetch(`${this.baseURL}/groups?session_id=${sessionId}`, {
      method: 'GET',
      headers: this.getHeaders(apiKey)
    });
    
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to get groups: ${err}`);
    }
    return res.json();
  }

  static async getGroupMetadata(sessionId: string, groupId: string, apiKey?: string) {
    const res = await fetch(`${this.baseURL}/groups/${groupId}/metadata?session_id=${sessionId}`, {
      method: 'GET',
      headers: this.getHeaders(apiKey)
    });
    
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to get group metadata: ${err}`);
    }
    return res.json();
  }

  static async getGroupParticipants(sessionId: string, groupId: string, apiKey?: string) {
    const res = await fetch(`${this.baseURL}/groups/${groupId}/participants?session_id=${sessionId}`, {
      method: 'GET',
      headers: this.getHeaders(apiKey)
    });
    
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to get participants: ${err}`);
    }
    return res.json();
  }

  static async getGroupPicture(sessionId: string, groupId: string, apiKey?: string) {
    const res = await fetch(`${this.baseURL}/groups/${groupId}/picture?session_id=${sessionId}`, {
      method: 'GET',
      headers: this.getHeaders(apiKey)
    });
    
    if (!res.ok) return null;
    return res.json();
  }

  static async getGroupInviteLink(sessionId: string, groupId: string, apiKey?: string) {
    const res = await fetch(`${this.baseURL}/groups/${groupId}/invite-link?session_id=${sessionId}`, {
      method: 'GET',
      headers: this.getHeaders(apiKey)
    });
    
    if (!res.ok) return null;
    return res.json();
  }

  static async getProfilePicture(sessionId: string, jid: string, apiKey?: string) {
    const res = await fetch(`${this.baseURL}/profile-picture?session_id=${sessionId}&jid=${jid}`, {
      method: 'GET',
      headers: this.getHeaders(apiKey)
    });
    
    if (!res.ok) return null; // Avatares podem falhar suavemente
    return res.json();
  }

  // ─── Messaging ──────────────────────────────────────────────────────────

  /**
   * Envia uma mensagem para um destino via Wasender (Texto ou Imagem+Legenda).
   * @param sessionApiKey - Chave de API única da sessão
   * @param to - Número do destinatário
   * @param message - Corpo da mensagem ou legenda
   * @param imageUrl - URL opcional da imagem
   */
  static async sendMessage(sessionApiKey: string, to: string, message: string, imageUrl?: string) {
    const payload: Record<string, any> = {
      to,
      text: message || ''
    };

    if (imageUrl) {
      payload.imageUrl = imageUrl;
    }

    const res = await fetch(`${this.baseURL}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionApiKey}`
      },
      body: JSON.stringify(payload)
    });

    // O wasender muitas vezes volta sucesso no HTTP mas erro no JSON
    const data = await res.json();
    
    // Sucesso Real: Baseado no campo success ou presença de identificador
    // O Wasender pode retornar status 'pending', 'accepted', 'sent', etc.
    const hasId = !!(data?.message_id || data?.id || data?.data?.id || data?.messageId || data?.data?.msgId);

    if (!res.ok || data.success === false) {
      const errorMsg = data.message || data.error || JSON.stringify(data.errors) || 'Unknown Error';
      console.error(`[WASENDER-CLIENT] [SEND-FAILURE] Status: ${res.status} | Content: ${JSON.stringify(data)}`);
      throw new Error(`Failed to send message: ${errorMsg}`);
    }

    // Normalizar retorno para garantir id no topo (usado pelo worker/monitor)
    if (!data.id && hasId) {
        data.id = data.message_id || data.data?.id || data.messageId || data.data?.msgId;
    }

    return data;
  }

  /**
   * Envia uma mensagem com imagem e texto opcional.
   * Alias para sendMessage com imageUrl.
   */
  static async sendImage(sessionApiKey: string, to: string, imageUrl: string, caption?: string) {
    return this.sendMessage(sessionApiKey, to, caption || '', imageUrl);
  }
}
