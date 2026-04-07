// src/app/api/webhooks/wasender/route.ts
// Webhook endpoint para receber eventos do Wasender com validação HMAC por canal.
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const signature = request.headers.get('x-wasender-signature')
      || request.headers.get('webhook-signature')
      || '';

    // Ler o raw body antes de parsear JSON (necessário para validação HMAC)
    const rawBody = await request.text();
    let body: any;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const eventType = body.event || body.type;

    if (!eventType) {
      return NextResponse.json({ error: 'Event type not found' }, { status: 400 });
    }

    const supabase = createClient();

    // Extrair sessionId do payload
    const sessionId = body.data?.session_id || body.sessionId || body.data?.id;

    if (!sessionId) {
      // Evento global (ping/health) — responder 200
      return NextResponse.json({ received: true });
    }

    // ─── 1. Identificar o canal vinculado a essa sessão ────────────────────
    const { data: channels, error } = await supabase
      .from('channels')
      .select('id, user_id, config')
      .contains('config', { sessionId });

    if (error || !channels || channels.length === 0) {
      return NextResponse.json({ error: 'Channel not found for this session' }, { status: 404 });
    }

    const channel = channels[0];

    // ─── 2. Validar Assinatura com webhook_secret do banco ─────────────────
    // Buscar o webhook_secret específico desse canal na tabela de segredos
    // Nota: Precisamos usar service role para ler channel_secrets (RLS bloqueado para client)
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

      default:
        console.log(`Unhandled webhook event: ${eventType}`, body);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Wasender Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
