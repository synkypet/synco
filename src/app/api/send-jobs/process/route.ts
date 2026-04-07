// src/app/api/send-jobs/process/route.ts
// Worker de fila v2 — Provider Engine: desacoplado, com retry inteligente e rate limit por destino.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProvider } from '@/lib/providers/factory';
import type { SendResult, ErrorType } from '@/lib/providers/types';

// ─── Configuração Global ────────────────────────────────────────────────────
const MAX_RETRIES = parseInt(process.env.SEND_MAX_RETRIES || '3', 10);
const DESTINATION_RATE_LIMIT_MS = parseInt(process.env.DESTINATION_RATE_LIMIT_MS || '1500', 10);

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Rate Limit por Destino (Map em memória) ────────────────────────────────
const destinationLastSent = new Map<string, number>();

function canSendToDestination(destination: string): boolean {
  const lastSent = destinationLastSent.get(destination);
  if (!lastSent) return true;
  return (Date.now() - lastSent) >= DESTINATION_RATE_LIMIT_MS;
}

function markDestinationSent(destination: string) {
  destinationLastSent.set(destination, Date.now());
}

// ─── Structured Logger ──────────────────────────────────────────────────────
function logJob(level: 'INFO' | 'ERROR' | 'WARN', jobId: string, data: Record<string, any>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    jobId,
    ...data,
  };
  if (level === 'ERROR') {
    console.error('[WORKER]', JSON.stringify(entry));
  } else if (level === 'WARN') {
    console.warn('[WORKER]', JSON.stringify(entry));
  } else {
    console.log('[WORKER]', JSON.stringify(entry));
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();

    // ─── 1. Autenticação ─────────────────────────────────────────────────
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ─── 2. Buscar jobs pendentes ────────────────────────────────────────
    // Batch size dinâmico: usa o menor entre os providers ativos
    const defaultBatchSize = parseInt(process.env.SEND_BATCH_SIZE || '10', 10);

    const { data: jobs, error: fetchError } = await supabase
      .from('send_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(defaultBatchSize);

    if (fetchError) {
      throw new Error(`Failed to fetch jobs: ${fetchError.message}`);
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No pending jobs' });
    }

    const results: { jobId: string; status: string; error?: string; errorType?: string }[] = [];

    for (const job of jobs) {
      // ─── 3. Lock otimista ──────────────────────────────────────────────
      await supabase
        .from('send_jobs')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', job.id)
        .eq('status', 'pending');

      // ─── 4. Idempotência ──────────────────────────────────────────────
      if (job.campaign_id) {
        const { data: existingReceipt } = await supabase
          .from('send_receipts')
          .select('id')
          .eq('campaign_id', job.campaign_id)
          .eq('campaign_item_id', job.campaign_item_id || '')
          .eq('destination', job.destination)
          .limit(1)
          .maybeSingle();

        if (existingReceipt) {
          await supabase
            .from('send_jobs')
            .update({
              status: 'completed',
              last_error: 'Skipped: duplicate (idempotency)',
              processed_at: new Date().toISOString()
            })
            .eq('id', job.id);

          logJob('INFO', job.id, { action: 'skipped_duplicate', destination: job.destination });
          results.push({ jobId: job.id, status: 'skipped_duplicate' });
          continue;
        }
      }

      // ─── 5. Resolver canal e provider ──────────────────────────────────
      let apiKey = '';
      let channelType = 'whatsapp';

      try {
        const { data: channel } = await supabase
          .from('channels')
          .select('config, type')
          .eq('id', job.channel_id)
          .single();

        channelType = channel?.type || 'whatsapp';
        const sessionStatus = channel?.config?.status;

        if (sessionStatus === 'session_lost' || sessionStatus === 'disconnected') {
          await supabase
            .from('send_jobs')
            .update({
              status: 'failed',
              error_type: 'PERMANENT',
              last_error: `Canal indisponível: ${sessionStatus}`,
              try_count: job.try_count + 1,
              processed_at: new Date().toISOString()
            })
            .eq('id', job.id);

          logJob('ERROR', job.id, { action: 'channel_unavailable', channelType, status: sessionStatus });
          results.push({ jobId: job.id, status: 'failed', error: `session_${sessionStatus}`, errorType: 'PERMANENT' });
          continue;
        }

        const { data: secretData } = await supabase
          .from('channel_secrets')
          .select('session_api_key')
          .eq('channel_id', job.channel_id)
          .maybeSingle();

        apiKey = secretData?.session_api_key || '';

        if (!apiKey) {
          throw new Error('Chave de API do canal não encontrada. Reconecte no painel.');
        }

      } catch (authErr: any) {
        await supabase
          .from('send_jobs')
          .update({
            status: 'failed',
            error_type: 'PERMANENT',
            last_error: authErr.message || 'Erro de autenticação',
            try_count: job.try_count + 1,
            processed_at: new Date().toISOString()
          })
          .eq('id', job.id);

        logJob('ERROR', job.id, { action: 'auth_failed', channelType, error: authErr.message });
        results.push({ jobId: job.id, status: 'failed', error: 'missing_auth', errorType: 'PERMANENT' });
        continue;
      }

      // ─── 6. Rate Limit por Destino ─────────────────────────────────────
      if (!canSendToDestination(job.destination)) {
        // Devolve pra fila pra ser processado na próxima rodada
        await supabase
          .from('send_jobs')
          .update({ status: 'pending', updated_at: new Date().toISOString() })
          .eq('id', job.id);

        logJob('WARN', job.id, { action: 'rate_limited', destination: job.destination });
        results.push({ jobId: job.id, status: 'rate_limited' });
        continue;
      }

      // ─── 7. Enviar via Provider ────────────────────────────────────────
      const provider = getProvider(channelType);
      const formattedDestination = provider.formatDestination(job.destination);
      const messageText = job.message_body || '';

      logJob('INFO', job.id, { action: 'sending', channelType, destination: formattedDestination });

      let result: SendResult;

      if (job.image_url) {
        result = await provider.sendMedia(apiKey, formattedDestination, job.image_url, messageText);
      } else {
        result = await provider.sendMessage(apiKey, formattedDestination, messageText);
      }

      // ─── 8. Processar resultado ────────────────────────────────────────
      if (result.success) {
        markDestinationSent(job.destination);

        await supabase
          .from('send_jobs')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
            try_count: job.try_count + 1
          })
          .eq('id', job.id);

        await supabase
          .from('send_receipts')
          .insert({
            send_job_id: job.id,
            user_id: job.user_id,
            campaign_id: job.campaign_id,
            campaign_item_id: job.campaign_item_id || null,
            destination: job.destination,
            status: 'delivered',
            wasender_message_id: result.messageId,
            delivered_at: new Date().toISOString()
          });

        logJob('INFO', job.id, { action: 'delivered', channelType, messageId: result.messageId });
        results.push({ jobId: job.id, status: 'completed' });

      } else {
        // Erro — classificar e decidir retry vs fail
        const errorType: ErrorType = result.errorType || provider.classifyError(result.error);
        const newTryCount = job.try_count + 1;

        let finalStatus: string;

        if (errorType === 'PERMANENT') {
          finalStatus = 'failed';
        } else if (newTryCount >= MAX_RETRIES) {
          finalStatus = 'failed';
        } else {
          finalStatus = 'pending'; // Volta pra fila
        }

        await supabase
          .from('send_jobs')
          .update({
            status: finalStatus,
            error_type: errorType,
            try_count: newTryCount,
            last_error: result.error,
            processed_at: new Date().toISOString()
          })
          .eq('id', job.id);

        logJob(errorType === 'PERMANENT' ? 'ERROR' : 'WARN', job.id, {
          action: finalStatus === 'failed' ? 'failed_final' : 'retry_scheduled',
          channelType,
          errorType,
          error: result.error,
          attempt: newTryCount,
        });

        // ─── 9. Fallback Multi-Canal ─────────────────────────────────────
        if (finalStatus === 'failed' && job.fallback_channel_id) {
          logJob('INFO', job.id, { action: 'fallback_triggered', fallbackChannelId: job.fallback_channel_id });

          await supabase
            .from('send_jobs')
            .insert({
              user_id: job.user_id,
              channel_id: job.fallback_channel_id,
              session_id: job.session_id,
              campaign_id: job.campaign_id,
              campaign_item_id: job.campaign_item_id,
              destination: job.destination,
              destination_name: job.destination_name,
              message_body: job.message_body,
              message_type: job.message_type,
              image_url: job.image_url,
              status: 'pending',
              try_count: 0,
              fallback_channel_id: null, // Evitar loop infinito
            });
        }

        results.push({ jobId: job.id, status: finalStatus, error: result.error, errorType });
      }

      // ─── 10. Cooldown por provider ─────────────────────────────────────
      await sleep(provider.getCooldownMs());
    }

    return NextResponse.json({
      processed: results.length,
      results
    });

  } catch (error: any) {
    console.error('[WORKER] Fatal Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
