import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractWebhookMessageContext } from '@/lib/wasender/parser';
import { processInboundAutomation } from '@/lib/automation/processor';
import { triggerWorker } from '@/lib/worker/trigger';

/**
 * Lógica centralizada de processamento de webhooks da Wasender.
 * Compartilhada entre o endpoint moderno e o proxy legado.
 */
export async function handleWasenderWebhook(request: Request, requestId: string) {
  console.log('[WEBHOOK-LOGIC-CENTRALIZED]', { requestId });
  try {
    const signature = request.headers.get('x-wasender-signature')
      || request.headers.get('webhook-signature')
      || request.headers.get('x-webhook-signature')
      || '';

    // Ler o raw body antes de parsear JSON (necessário para validação HMAC)
    const rawBody = await request.text();
    console.log(`[WEBHOOK-PAYLOAD] [${requestId}] Raw body length: ${rawBody.length}`);

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error(`[WEBHOOK-ABORT] [${requestId}] Falha ao parsear JSON.`);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const eventType = body.event || body.type;
    if (!eventType) {
      console.error(`[WEBHOOK-ABORT] [${requestId}] Tipo de evento (event/type) não encontrado no payload.`);
      return NextResponse.json({ error: 'Event type not found' }, { status: 400 });
    }

    // Usar admin client para bypass de RLS e garantir visibilidade dos canais
    const supabase = createAdminClient();

    // Extrair sessionId do payload
    const sessionIdRaw = body.data?.session_id || body.sessionId || body.data?.id;
    
    if (!sessionIdRaw) {
      console.log(`[WEBHOOK-SESSION] [${requestId}] Evento sem sessionId (provavelmente Health/Ping).`);
      return NextResponse.json({ received: true });
    }

    const sessionId = String(sessionIdRaw);
    
    // Log de entrada precoce para diagnóstico de conectividade
    await supabase.from('automation_logs').insert({
      user_id: '00000000-0000-0000-0000-000000000000', // Log neutro até identificar o canal
      status: 'captured',
      event_type: 'webhook_received',
      details: { requestId, eventType, sessionId, bodySize: rawBody.length }
    });
    
    // ─── 1. Identificar o canal vinculado a essa sessão ────────────────────
    let channel: any = null;

    // TENTATIVA 1: Busca por ID Numérico (wasender_session_id ou sessionId legado)
    const { data: channels, error: channelError } = await supabase
      .from('channels')
      .select('id, user_id, config')
      .or(`config->>wasender_session_id.eq.${sessionId},config->>sessionId.eq.${sessionId}`);

    if (channels && channels.length > 0) {
      channel = channels[0];
    } else {
      // TENTATIVA 2: Fallback por Hash ID (session_api_key em channel_secrets)
      const { data: secretData } = await supabase
        .from('channel_secrets')
        .select('channel_id')
        .eq('session_api_key', sessionId)
        .single();

      if (secretData) {
        const { data: channelData } = await supabase
          .from('channels')
          .select('id, user_id, config')
          .eq('id', secretData.channel_id)
          .single();
        
        if (channelData) {
          channel = channelData;
        }
      }
    }

    if (!channel) {
      console.error(`[WEBHOOK-ABORT] [${requestId}] Canal não encontrado para sessionId ${sessionId}.`);
      await supabase.from('automation_logs').insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        status: 'error',
        event_type: 'webhook_channel_mismatch',
        details: { requestId, sessionId, reason: 'Nenhum canal encontrado para este sessionId no banco de dados.' }
      });
      return NextResponse.json({ error: 'Channel not found for this session' }, { status: 404 });
    }

    const userTag = `[USER:${channel.user_id.substring(0, 8)}]`;

    // ─── 2. Validar Assinatura (MODO PERMISSIVO - SOFT FAIL) ─────────────────
    const { data: secrets } = await supabase
      .from('channel_secrets')
      .select('webhook_secret')
      .eq('channel_id', channel.id)
      .single();

    const webhookSecret = secrets?.webhook_secret;

    if (webhookSecret) {
      if (!signature) {
        console.warn(`[WEBHOOK-NO-SIGNATURE] ${userTag} [${requestId}] Assinatura ausente para canal ${channel.id}. Prosseguindo em modo permissivo.`);
      } else {
        const expectedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(rawBody)
          .digest('hex');

        if (signature !== expectedSignature) {
          console.error(`[WEBHOOK-SIGNATURE-MISMATCH] ${userTag} [${requestId}] Mismatch para canal ${channel.id}.`);
        } else {
          console.log(`[WEBHOOK-AUTH] ${userTag} [${requestId}] ✓ Assinatura validada com sucesso.`);
        }
      }
    }

    // ─── 3. Tratamento dos Eventos ─────────────────────────────────────────
    const currentConfig = channel.config || {};

    switch (eventType) {
      case 'session.status': {
        const rawStatus = (body.data?.status || '').toUpperCase();
        let newStatus = currentConfig.status;

        if (rawStatus.includes('CONNECTED')) {
          newStatus = 'connected';
        } else if (rawStatus.includes('DISCONNECTED')) {
          newStatus = 'disconnected';
        } else if (rawStatus.includes('SCAN') || rawStatus.includes('QR') || rawStatus.includes('PENDING')) {
          newStatus = 'qrcode_pending';
        } else {
          newStatus = 'session_lost';
        }

        if (newStatus !== currentConfig.wasender_status || newStatus !== currentConfig.status) {
          await supabase.from('channels').update({
            config: { ...currentConfig, status: newStatus, wasender_status: newStatus }
          }).eq('id', channel.id);
        }

        if (newStatus === 'session_lost' || newStatus === 'disconnected') {
          await supabase
            .from('send_jobs')
            .update({ status: 'cancelled', last_error: `Session ${newStatus}` })
            .eq('channel_id', channel.id)
            .eq('status', 'pending');
        }
        break;
      }

      case 'messages.received':
      case 'messages-group.received': {
        const context = extractWebhookMessageContext(body);
        
        const automPayload = {
          userId: channel.user_id,
          channelId: channel.id,
          externalGroupId: context.externalGroupId,
          messageId: context.messageId,
          body: context.body,
          isFromMe: context.isFromMe,
        };

        if (automPayload.isFromMe) {
          break;
        }

        try {
          console.log(`[WEBHOOK] ${userTag} [${requestId}] [DIRECT-LOGIC] Processando automação...`);
          const result = await processInboundAutomation(automPayload);
          
          if (result && !result.skipped && result.processed && result.processed > 0) {
            console.log(`[WEBHOOK] ${userTag} [${requestId}] Processamento concluído com ${result.processed} itens. Acionando worker...`);
            await triggerWorker({ requestId });
          } else {
            console.log(`[WEBHOOK] ${userTag} [${requestId}] Processamento concluído sem itens válidos ou pulado. Não acionando worker.`);
          }
        } catch (err: any) {
          console.error(`[WEBHOOK-ERROR-FATAL] ${userTag} [${requestId}] Falha no processamento:`, err.message);
        }
        break;
      }

      case 'message.sent':
      case 'message.failed':
      case 'qrcode.updated':
        // Silently handle these common events without logic for now
        break;

      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Webhook Handler Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
