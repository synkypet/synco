// src/lib/providers/types.ts
// Interface central do Provider Engine — todo canal de envio implementa este contrato.

export type ErrorType = 'TEMPORARY' | 'PERMANENT' | 'SESSION_LOST';

export interface SendResult {
  success: boolean;
  messageId?: string | null;
  error?: string;
  errorType?: ErrorType;
}

/**
 * Contrato que todo canal de envio deve implementar.
 * O Worker consome APENAS esta interface — nunca importa Telegram ou Wasender diretamente.
 */
export interface ChannelProvider {
  /** Envia mensagem de texto puro */
  sendMessage(apiKey: string, destination: string, text: string): Promise<SendResult>;

  /** Envia mídia (imagem) com legenda */
  sendMedia(apiKey: string, destination: string, mediaUrl: string, caption: string): Promise<SendResult>;

  /** Formata o destino cru para o formato esperado pela API do canal */
  formatDestination(raw: string): string;

  /** Classifica um erro como TEMPORARY ou PERMANENT */
  classifyError(error: any): ErrorType;

  /** Retorna o cooldown em ms entre mensagens deste provider */
  getCooldownMs(): number;

  /** Retorna o tamanho do batch padrão deste provider */
  getBatchSize(): number;
}
