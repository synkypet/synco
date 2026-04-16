// src/lib/providers/whatsapp.provider.ts
import { ChannelProvider, SendResult, ErrorType } from './types';
import { WasenderClient } from '@/lib/wasender/client';

// Patterns de erro permanente da WasenderAPI
const PERMANENT_ERROR_PATTERNS = [
  'invalid whatsapp',
  'not a valid',
  'number does not exist',
  'is not registered',
  'invalid jid',
  'not on whatsapp',
  'receiver is not valid',
  'blocked',
  'must be a valid whatsapp jid', // 422 - JID inválido
  'the to must be',               // 422 - campo "to" inválido
];

export class WhatsAppProvider implements ChannelProvider {

  async sendMessage(apiKey: string, destination: string, text: string): Promise<SendResult> {
    try {
      const data = await WasenderClient.sendMessage(apiKey, destination, text);
      const messageId = data?.message_id || data?.id || data?.data?.id || null;
      return {
        success: true,
        messageId: messageId?.toString() || null,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        errorType: this.classifyError(error),
      };
    }
  }

  async sendMedia(apiKey: string, destination: string, mediaUrl: string, caption: string): Promise<SendResult> {
    try {
      const data = await WasenderClient.sendImage(apiKey, destination, mediaUrl, caption);
      const messageId = data?.message_id || data?.id || data?.data?.id || null;
      return {
        success: true,
        messageId: messageId?.toString() || null,
      };
    } catch (error: any) {
      const errorMsg = error.message || 'Erro desconhecido';
      
      console.error(`[WHATSAPP-IMAGE-FAILURE] [${new Date().toISOString()}] Falha ao enviar mídia.`);
      console.error(`- Destination: ${destination}`);
      console.error(`- Image URL: ${mediaUrl}`);
      console.error(`- Error: ${errorMsg}`);
      
      console.warn(`[WHATSAPP-PROVIDER] [${new Date().toISOString()}] Acionando fallback para texto puro devido a erro na mídia.`);
      
      // Se for erro permanente de destino (ex: número inválido), o fallback para texto também falhará.
      // Mas se for erro de processamento de mídia na Wasender, o texto pode funcionar.
      return this.sendMessage(apiKey, destination, caption);
    }
  }

  /**
   * Normaliza o destino para o formato JID completo que a Wasender exige.
   * Regras:
   *  - Grupo:   mantém/adiciona sufixo @g.us        (ex: 1234567890@g.us)
   *  - Número:  mantém/adiciona sufixo @s.whatsapp.net (ex: 5511999999999@s.whatsapp.net)
   *  - JIDs já completos passam sem alteração.
   */
  formatDestination(raw: string): string {
    // JID já completo (grupo ou usuário) — não modificar
    if (raw.includes('@g.us') || raw.includes('@s.whatsapp.net') || raw.includes('@c.us')) {
      return raw;
    }

    const digits = raw.replace(/[^\d]/g, '');

    // Heurística: IDs de grupo do WhatsApp têm 18+ dígitos
    if (digits.length >= 15) {
      return `${digits}@g.us`;
    }

    // Número pessoal: usar @s.whatsapp.net
    return `${digits}@s.whatsapp.net`;
  }

  classifyError(error: any): ErrorType {
    const msg = (error?.message || error || '').toString().toLowerCase();
    for (const pattern of PERMANENT_ERROR_PATTERNS) {
      if (msg.includes(pattern.toLowerCase())) {
        return 'PERMANENT';
      }
    }
    // Rate limit é temporário
    if (msg.includes('rate limit') || msg.includes('retry_after') || msg.includes('too many') || msg.includes('every 5 seconds')) {
      return 'TEMPORARY';
    }
    return 'TEMPORARY';
  }

  getCooldownMs(): number {
    // Mínimo de 5500ms entre envios para respeitar o limite da Wasender (1 msg/5s)
    return parseInt(process.env.SEND_COOLDOWN_MS || '5500', 10);
  }

  getBatchSize(): number {
    return parseInt(process.env.SEND_BATCH_SIZE || '5', 10);
  }
}
