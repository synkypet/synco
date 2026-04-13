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

    // Só incluir webhook se tiver URL pública
    if (params.webhookUrl) {
      body.webhook_url = params.webhookUrl;
      body.webhook_enabled = true;
      body.webhook_events = [
        'messages.received',
        'session.status',
        'messages.update',
        'qrcode.updated'
      ];
    }

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

  static async getStatus(sessionId: string, apiKey?: string) {
    const url = apiKey 
      ? `${this.baseURL}/status` 
      : `${this.baseURL}/whatsapp-sessions/${sessionId}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(apiKey)
    });
    
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to get status: ${err}`);
    }
    return res.json();
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

  static async logoutSession(sessionId: string) {
    const res = await fetch(`${this.baseURL}/whatsapp-sessions/${sessionId}/logout`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to disconnect/logout session: ${err}`);
    }
    return res.json();
  }

  static async deleteSession(sessionId: string) {
    const res = await fetch(`${this.baseURL}/whatsapp-sessions/${sessionId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to delete session: ${err}`);
    }
    return res.json();
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
   * Envia uma mensagem de texto para um destino via Wasender.
   * IMPORTANTE: Envio requer a API_KEY da sessão (e não o PAT global) e a rota /send-message.
   * @param sessionApiKey - Chave de API única da sessão (do channel_secrets)
   * @param to - Número do destinatário
   * @param message - Corpo da mensagem
   */
  static async sendMessage(sessionApiKey: string, to: string, message: string) {
    const res = await fetch(`${this.baseURL}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionApiKey}`
      },
      body: JSON.stringify({
        to,
        text: message
      })
    });

    // O wasender muitas vezes volta sucesso, mas message=..., precisamos checar res.json
    const data = await res.json();
    
    if (!res.ok || data.success === false) {
      throw new Error(`Failed to send message: ${data.message || JSON.stringify(data.errors) || 'Unknown Error'}`);
    }
    return data;
  }

  /**
   * Envia uma mensagem com imagem e texto opcional.
   * @param sessionApiKey - Chave de API da sessão
   * @param to - Número ou remote_id do grupo
   * @param imageUrl - URL da imagem
   * @param caption - Texto opcional embaixo da imagem
   */
  static async sendImage(sessionApiKey: string, to: string, imageUrl: string, caption?: string) {
    const res = await fetch(`${this.baseURL}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionApiKey}`
      },
      body: JSON.stringify({
        to,
        image: imageUrl,
        text: caption || ''
      })
    });

    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(`Failed to send image: ${data.message || JSON.stringify(data.errors) || 'Unknown Error'}`);
    }
    return data;
  }
}
