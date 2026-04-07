// src/lib/providers/telegram.provider.ts
import { ChannelProvider, SendResult, ErrorType } from './types';
import { TelegramClient } from '@/lib/telegram/client';

// Patterns de erro permanente da Telegram Bot API
const PERMANENT_ERROR_PATTERNS = [
  'chat not found',
  'bot was blocked',
  'bot was kicked',
  'user is deactivated',
  'chat_id is empty',
  'PEER_ID_INVALID',
  'bot is not a member',
  'not enough rights',
  'have no rights',
  'group chat was deactivated',
  'need administrator rights',
];

export class TelegramProvider implements ChannelProvider {

  async sendMessage(apiKey: string, destination: string, text: string): Promise<SendResult> {
    try {
      const data = await TelegramClient.sendMessage(apiKey, destination, text);
      return {
        success: true,
        messageId: data?.result?.message_id?.toString() || null,
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
      const data = await TelegramClient.sendPhoto(apiKey, destination, mediaUrl, caption);
      return {
        success: true,
        messageId: data?.result?.message_id?.toString() || null,
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
    // Telegram aceita chat_id direto (positivo ou negativo). Sem formatação necessária.
    return raw.trim();
  }

  classifyError(error: any): ErrorType {
    const msg = (error?.message || error || '').toString().toLowerCase();
    for (const pattern of PERMANENT_ERROR_PATTERNS) {
      if (msg.includes(pattern.toLowerCase())) {
        return 'PERMANENT';
      }
    }
    return 'TEMPORARY';
  }

  getCooldownMs(): number {
    return parseInt(process.env.TELEGRAM_COOLDOWN_MS || '1100', 10);
  }

  getBatchSize(): number {
    return parseInt(process.env.TELEGRAM_BATCH_SIZE || '20', 10);
  }
}
