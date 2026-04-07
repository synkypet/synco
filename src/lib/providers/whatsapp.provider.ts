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
      return {
        success: false,
        error: error.message,
        errorType: this.classifyError(error),
      };
    }
  }

  formatDestination(raw: string): string {
    // Wasender exige apenas dígitos (sem +, espaços, hifens, ou @c.us)
    return raw.replace(/[^\d]/g, '');
  }

  classifyError(error: any): ErrorType {
    const msg = (error?.message || error || '').toString().toLowerCase();
    for (const pattern of PERMANENT_ERROR_PATTERNS) {
      if (msg.includes(pattern.toLowerCase())) {
        return 'PERMANENT';
      }
    }
    // Rate limit é temporário
    if (msg.includes('rate limit') || msg.includes('retry_after') || msg.includes('too many')) {
      return 'TEMPORARY';
    }
    return 'TEMPORARY';
  }

  getCooldownMs(): number {
    return parseInt(process.env.SEND_COOLDOWN_MS || '3000', 10);
  }

  getBatchSize(): number {
    return parseInt(process.env.SEND_BATCH_SIZE || '5', 10);
  }
}
