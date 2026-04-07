import { WasenderSessionStatus } from '@/types/group';

export class WasenderClient {
  private static get baseURL() {
    return process.env.WASENDER_API_URL || 'https://wasenderapi.com/api';
  }

  private static get pat() {
    return process.env.WASENDER_PAT;
  }

  private static get headers() {
    return {
      'Content-Type': 'application/json',
      'X-Api-Key': this.pat || '',
      'Authorization': `Bearer ${this.pat || ''}`
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
      headers: this.headers,
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
      headers: this.headers
    });
    
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to connect session: ${err}`);
    }
    return res.json();
  }

  static async getStatus(sessionId: string) {
    const res = await fetch(`${this.baseURL}/whatsapp-sessions/${sessionId}/status`, {
      method: 'GET',
      headers: this.headers
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
      headers: this.headers
    });
    
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to get QR code: ${err}`);
    }
    return res.json(); 
  }

  // ─── Groups ─────────────────────────────────────────────────────────────

  static async getGroups(sessionId: string) {
    const res = await fetch(`${this.baseURL}/groups?session_id=${sessionId}`, {
      method: 'GET',
      headers: this.headers
    });
    
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to get groups: ${err}`);
    }
    return res.json();
  }

  // ─── Messaging ──────────────────────────────────────────────────────────

  /**
   * Envia uma mensagem de texto para um destino via Wasender.
   * @param sessionId - ID da sessão Wasender
   * @param to - Número ou remote_id do grupo (ex: "5511999999999@c.us" ou "120363...@g.us")
   * @param message - Corpo da mensagem
   * @returns Resposta da API Wasender com message_id
   */
  static async sendMessage(sessionId: string, to: string, message: string) {
    const res = await fetch(`${this.baseURL}/send/messages`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        session_id: sessionId,
        to,
        type: 'text',
        text: message
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to send message: ${err}`);
    }
    return res.json();
  }

  /**
   * Envia uma mensagem com imagem e texto opcional.
   * @param sessionId - ID da sessão Wasender
   * @param to - Número ou remote_id do grupo
   * @param imageUrl - URL da imagem
   * @param caption - Texto opcional embaixo da imagem
   */
  static async sendImage(sessionId: string, to: string, imageUrl: string, caption?: string) {
    const res = await fetch(`${this.baseURL}/send/messages`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        session_id: sessionId,
        to,
        type: 'image',
        image: { url: imageUrl },
        caption: caption || ''
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to send image: ${err}`);
    }
    return res.json();
  }
}
