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
const channelLastSent = new Map<string, number>();

function canSendToDestination(destination: string): boolean {
  const lastSent = destinationLastSent.get(destination);
  if (!lastSent) return true;
  return (Date.now() - lastSent) >= DESTINATION_RATE_LIMIT_MS;
}

function markDestinationSent(destination: string) {
  destinationLastSent.set(destination, Date.now());
}

function canSendFromChannel(channelId: string, cooldownMs: number): boolean {
  const lastSent = channelLastSent.get(channelId);
  if (!lastSent) return true;
  return (Date.now() - lastSent) >= cooldownMs;
}

function markChannelSent(channelId: string) {
  channelLastSent.set(channelId, Date.now());
}

// ─── Structured Logger ──────────────────────────────────────────────────────
function logJob(level: 'INFO' | 'ERROR' | 'WARN', jobId: string, data: Record<string, any>, requestId?: string) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    jobId,
    reqId: requestId,
    ...data,
  };
  if (level === 'ERROR') {
    console.error(`[WORKER] [${requestId || 'SYSTEM'}]`, JSON.stringify(entry));
  } else if (level === 'WARN') {
    console.warn(`[WORKER] [${requestId || 'SYSTEM'}]`, JSON.stringify(entry));
  } else {
    console.log(`[WORKER] [${requestId || 'SYSTEM'}]`, JSON.stringify(entry));
  }
}

export async function POST(request: Request) {
  const incomingRequestId = request.headers.get('x-request-id');
  const requestId = incomingRequestId || Math.random().toString(36).substring(7);
  
  console.log(`[WORKER-START] [${requestId}] ${incomingRequestId ? 'Acionamento via Fast-Trigger' : 'Acionamento via Cron/Manual'}. Iniciando processamento...`);

  try {
    const supabase = createAdminClient();

    // ─── 1. Autenticação ─────────────────────────────────────────────────
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      console.warn(`[WORKER-FAIL] [${requestId}] Falha de autenticação: Secret inválido.`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ─── 2. Buscar jobs — Algoritmo Fila Justa (Round-Robin) ───────────
    const CHANNELS_PER_BATCH = 15;
    const JOBS_PER_CHANNEL = 3;
    const globalBatchSize = parseInt(process.env.SEND_BATCH_SIZE || '15', 10);

    // Etapa A: Identificar canais ativos com jobs pendentes
    // Limitação MVP: Deduplicação em memória para compensar falta de DISTINCT no PostgREST
    const { data: recentPendingJobs, error: sampleError } = await supabase
      .from('send_jobs')
      .select('channel_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100);

    if (sampleError) throw new Error(`Fetch sample error: ${sampleError.message}`);

    const activeChannelIds = [...new Set((recentPendingJobs || []).map(j => j.channel_id))]
      .slice(0, CHANNELS_PER_BATCH);

    // Etapa B: Buscar fatias de cada canal para intercalar (Round-Robin)
    const interleavedJobs: any[] = [];
    const jobsByChannel: Record<string, any[]> = {};

    for (const channelId of activeChannelIds) {
      const { data: channelJobs } = await supabase
        .from('send_jobs')
        .select('*')
        .eq('channel_id', channelId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(JOBS_PER_CHANNEL);
      
      if (channelJobs && channelJobs.length > 0) {
        jobsByChannel[channelId] = channelJobs;
      }
    }

    // Etapa C: Intercalar jobs na lista final
    let hasMore = true;
    let index = 0;
    while (hasMore && interleavedJobs.length < globalBatchSize) {
      hasMore = false;
      for (const channelId of activeChannelIds) {
        if (jobsByChannel[channelId] && jobsByChannel[channelId][index]) {
          interleavedJobs.push(jobsByChannel[channelId][index]);
          hasMore = true;
        }
      }
      index++;
    }

    const jobs = interleavedJobs;

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

          logJob('INFO', job.id, { action: 'skipped_duplicate', destination: job.destination }, requestId);
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
          .select('config, type, name')
          .eq('id', job.channel_id)
          .single();

        channelType = channel?.type || 'whatsapp';
        const sessionStatus = channel?.config?.status;

        if (sessionStatus === 'session_lost' || sessionStatus === 'disconnected') {
          const errorMsg = `Sessão Offline: O canal '${channel?.name || job.channel_id}' está desconectado. Reconecte no painel.`;
          await supabase
            .from('send_jobs')
            .update({
              status: 'failed',
              error_type: 'PERMANENT',
              last_error: errorMsg,
              try_count: job.try_count + 1,
              processed_at: new Date().toISOString()
            })
            .eq('id', job.id);

          logJob('ERROR', job.id, { action: 'channel_unavailable', channelType, status: sessionStatus }, requestId);
          results.push({ jobId: job.id, status: 'failed', error: 'session_lost', errorType: 'PERMANENT' });
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

        logJob('ERROR', job.id, { action: 'auth_failed', channelType, error: authErr.message }, requestId);
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

        logJob('WARN', job.id, { action: 'rate_limited', destination: job.destination }, requestId);
        results.push({ jobId: job.id, status: 'rate_limited' });
        continue;
      }

      // ─── 7. Pacing por Canal (Isolado) ──────────────────────────────────
      const provider = getProvider(channelType);
      
      if (!canSendFromChannel(job.channel_id, provider.getCooldownMs())) {
        // Devolve pra fila para processar em outra oportunidade ou próxima rodada
        await supabase
          .from('send_jobs')
          .update({ status: 'pending', updated_at: new Date().toISOString() })
          .eq('id', job.id);

        logJob('INFO', job.id, { action: 'channel_pacing', channelId: job.channel_id }, requestId);
        results.push({ jobId: job.id, status: 'pacing_skip' });
        continue;
      }

      // ─── 8. Enviar via Provider ────────────────────────────────────────
      const formattedDestination = provider.formatDestination(job.destination);
      const messageText = job.message_body || '';

      logJob('INFO', job.id, { action: 'sending', channelType, destination: formattedDestination }, requestId);

      let result: SendResult;

      if (job.image_url) {
        result = await provider.sendMedia(apiKey, formattedDestination, job.image_url, messageText);
      } else {
        result = await provider.sendMessage(apiKey, formattedDestination, messageText);
      }

      // ─── 8. Processar resultado ────────────────────────────────────────
      if (result.success) {
        markChannelSent(job.channel_id);
        markDestinationSent(job.destination);
        // ... resta do sucesso ...

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

        logJob('INFO', job.id, { action: 'delivered', channelType, messageId: result.messageId }, requestId);
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
        }, requestId);

        // ─── 9. Fallback Multi-Canal ─────────────────────────────────────
        if (finalStatus === 'failed' && job.fallback_channel_id) {
          logJob('INFO', job.id, { action: 'fallback_triggered', fallbackChannelId: job.fallback_channel_id }, requestId);

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
      // Removido Global Sleep fixo para permitir processamento paralelo de canais
      // Pacing agora é controlado individualmente por canSendFromChannel
    }

    console.log(`[WORKER-DONE] [${requestId}] Processamento finalizado. Jobs processados: ${results.length}`);

    return NextResponse.json({
      processed: results.length,
      results,
      requestId
    });

  } catch (error: any) {
    console.error('[WORKER] Fatal Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
