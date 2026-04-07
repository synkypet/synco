export class TelegramClient {
  private static getBaseUrl(token: string) {
    return `https://api.telegram.org/bot${token}`;
  }

  /**
   * Valida o token retornando os dados do bot
   */
  static async getMe(token: string) {
    const res = await fetch(`${this.getBaseUrl(token)}/getMe`, {
      method: 'GET',
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(`Failed to validate token: ${data.description || 'Unknown error'}`);
    }
    
    return data;
  }

  /**
   * Envia uma mensagem de texto longa
   */
  static async sendMessage(token: string, chatId: string, text: string) {
    const res = await fetch(`${this.getBaseUrl(token)}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(`Failed to send Telegram message: ${data.description || 'Unknown error'}`);
    }
    return data;
  }

  /**
   * Envia uma foto com legenda opcional
   */
  static async sendPhoto(token: string, chatId: string, photoUrl: string, caption?: string) {
    const res = await fetch(`${this.getBaseUrl(token)}/sendPhoto`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption: caption || '',
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(`Failed to send Telegram photo: ${data.description || 'Unknown error'}`);
    }
    return data;
  }

  /**
   * Registra um webhook no Telegram para receber atualizações
   */
  static async setWebhook(token: string, url: string, secretToken?: string) {
    const body: Record<string, any> = {
      url,
      allowed_updates: ['message', 'my_chat_member', 'chat_member'],
    };
    if (secretToken) {
      body.secret_token = secretToken;
    }

    const res = await fetch(`${this.getBaseUrl(token)}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(`Failed to set webhook: ${data.description || 'Unknown error'}`);
    }
    return data;
  }

  /**
   * Remove o webhook registrado
   */
  static async deleteWebhook(token: string) {
    const res = await fetch(`${this.getBaseUrl(token)}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: true }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(`Failed to delete webhook: ${data.description || 'Unknown error'}`);
    }
    return data;
  }
}
