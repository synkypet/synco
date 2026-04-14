import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractWebhookMessageContext } from '@/lib/wasender/parser';

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[WEBHOOK-START] [${requestId}] Recebendo requisição da Wasender...`);

  try {
    const signature = request.headers.get('x-wasender-signature')
      || request.headers.get('webhook-signature')
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

    // Extrair sessionId do payload (Tentando vários campos comuns da Wasender)
    const sessionIdRaw = body.data?.session_id || body.sessionId || body.data?.id;
    
    if (!sessionIdRaw) {
      console.log(`[WEBHOOK-SESSION] [${requestId}] Evento sem sessionId (provavelmente Health/Ping).`);
      return NextResponse.json({ received: true });
    }

    const sessionId = String(sessionIdRaw);
    console.log(`[WEBHOOK-SESSION] [${requestId}] ID Identificado: ${sessionId} (Type: ${typeof sessionIdRaw})`);

    // ─── 1. Identificar o canal vinculado a essa sessão ────────────────────
    let channel: any = null;

    // TENTATIVA 1: Busca por ID Numérico (wasender_session_id ou sessionId legado)
    console.log(`[WEBHOOK-LOOKUP] [${requestId}] Tentativa 1: Busca por ID numérico em channels...`);
    const { data: channels, error: channelError } = await supabase
      .from('channels')
      .select('id, user_id, config')
      .or(`config->>wasender_session_id.eq.${sessionId},config->>sessionId.eq.${sessionId}`);

    if (channels && channels.length > 0) {
      channel = channels[0];
      console.log(`[WEBHOOK-CHANNEL] [${requestId}] ✓ Canal encontrado via ID Numérico: ${channel.id}`);
    } else {
      // TENTATIVA 2: Fallback por Hash ID (session_api_key em channel_secrets)
      console.log(`[WEBHOOK-LOOKUP] [${requestId}] Tentativa 2: Busca por Hash ID (session_api_key) em channel_secrets...`);
      const { data: secretData } = await supabase
        .from('channel_secrets')
        .select('channel_id')
        .eq('session_api_key', sessionId)
        .single();

      if (secretData) {
        console.log(`[WEBHOOK-LOOKUP] [${requestId}] ✓ Hash ID localizado. Recuperando canal ${secretData.channel_id}...`);
        const { data: channelData } = await supabase
          .from('channels')
          .select('id, user_id, config')
          .eq('id', secretData.channel_id)
          .single();
        
        if (channelData) {
          channel = channelData;
          console.log(`[WEBHOOK-CHANNEL] [${requestId}] ✓ Canal encontrado via Hash ID: ${channel.id}`);
        }
      }
    }

    if (!channel) {
      console.error(`[WEBHOOK-ABORT] [${requestId}] Canal não encontrado para sessionId ${sessionId} (nem por ID numérico, nem por Hash).`, {
        error: channelError
      });
      return NextResponse.json({ error: 'Channel not found for this session' }, { status: 404 });
    }

    // ─── 2. Validar Assinatura com webhook_secret do banco ─────────────────
    // Buscar o webhook_secret específico desse canal na tabela de segredos
    const { data: secrets } = await supabase
      .from('channel_secrets')
      .select('webhook_secret')
      .eq('channel_id', channel.id)
      .single();

    const webhookSecret = secrets?.webhook_secret;

    if (webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (signature !== expectedSignature) {
        console.warn(`Webhook signature mismatch for channel ${channel.id}`);
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    } else if (!webhookSecret) {
      // Sem secret configurado — log de aviso mas processa
      console.warn(`No webhook_secret for channel ${channel.id}. Accepting request without validation.`);
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

        // Atualizar apenas se mudou
        if (newStatus !== currentConfig.status) {
          await supabase.from('channels').update({
            config: { ...currentConfig, status: newStatus }
          }).eq('id', channel.id);
        }

        // Se desconectou ou perdeu sessão, pausar jobs pendentes dessa sessão
        if (newStatus === 'session_lost' || newStatus === 'disconnected') {
          await supabase
            .from('send_jobs')
            .update({ status: 'cancelled', last_error: `Session ${newStatus}` })
            .eq('channel_id', channel.id)
            .eq('status', 'pending');
        }
        break;
      }

      case 'qrcode.updated': {
        // Atualizar lastSyncAt para indicar atividade
        await supabase.from('channels').update({
          config: { ...currentConfig, lastSyncAt: new Date().toISOString() }
        }).eq('id', channel.id);
        break;
      }

      case 'message.sent': {
        // Registrar confirmação de entrega (se houver message_id no payload)
        const messageId = body.data?.message_id;
        if (messageId) {
          await supabase
            .from('send_receipts')
            .update({ status: 'delivered' })
            .eq('wasender_message_id', messageId);
        }
        break;
      }

      case 'message.failed': {
        // Marcar recibo como falho
        const failedMessageId = body.data?.message_id;
        if (failedMessageId) {
          await supabase
            .from('send_receipts')
            .update({ status: 'failed' })
            .eq('wasender_message_id', failedMessageId);
        }
        break;
      }

      case 'messages.received':
      case 'messages-group.received':
      case 'message.received':
      case 'chat.message':
      case 'chat.message_received': {
        // ─── Automação de Entrada ──────────────────────────────────────────
        const eventSource = eventType;
        
        // Log estruturado do payload para diagnóstico profundo
        console.log(`[WEBHOOK-PARSER-INPUT] [${requestId}] Body.data:`, JSON.stringify(body.data || {}, null, 2));

        // Utilizar o novo utilitário de parsing centralizado e defensivo
        const context = extractWebhookMessageContext(body);
        
        console.log(`[WEBHOOK-PARSER-OUTPUT] [${requestId}] Contexto extraído:`, JSON.stringify(context, null, 2));

        const automPayload = {
          userId: channel.user_id,
          channelId: channel.id,
          externalGroupId: context.externalGroupId,
          messageId: context.messageId,
          body: context.body,
          isFromMe: context.isFromMe,
        };

        if (automPayload.isFromMe) {
          console.log(`[WEBHOOK] [${eventSource}] [${requestId}] Ignorando: mensagem enviada pelo próprio número.`);
          break;
        }

        // Se group ID ou body persistirem vazios, logar alerta crítico
        if (!automPayload.externalGroupId || !automPayload.body) {
           console.warn(`[WEBHOOK-WARNING] [${requestId}] Contexto incompleto capturado:`, automPayload);
        }

        // Disparar o processamento de forma assíncrona para responder rápido ao webhook
        const protocol = request.url.startsWith('https') ? 'https' : 'http';
        const host = request.headers.get('host');
        const baseUrl = `${protocol}://${host}`;

        console.log(`[WEBHOOK] [${eventSource}] [${requestId}] Disparando Processamento E2E...`, {
          target: `${baseUrl}/api/automations/process`,
          payload: {
            externalGroupId: automPayload.externalGroupId,
            messageId: automPayload.messageId,
            bodyLength: automPayload.body?.length
          }
        });

        // Fire and forget
        fetch(`${baseUrl}/api/automations/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(automPayload),
        }).catch(err => console.error('[WEBHOOK] Failed to trigger automation process:', err));

        break;
      }

      default:
        console.log(`Unhandled webhook event: ${eventType}`, body);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Wasender Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
