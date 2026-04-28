import { handleWasenderWebhook } from '@/lib/wasender/webhook-logic';

/**
 * Endpoint moderno de webhooks para Wasender.
 * Utiliza o handler centralizado para processamento.
 */
export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(7);
  console.log('[WEBHOOK-V2-ACTIVE]', { requestId });
  return handleWasenderWebhook(request, requestId);
}
