// src/app/api/send-jobs/process/route.ts
// Worker de fila v4 — Atomic Channel Locking & Smart Pacing Wait
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProvider } from '@/lib/providers/factory';
import { triggerWorker } from '@/lib/worker/trigger';
import type { SendResult, ErrorType } from '@/lib/providers/types';

// ─── Configuração Global ────────────────────────────────────────────────────
const MAX_RETRIES = parseInt(process.env.SEND_MAX_RETRIES || '3', 10);
const DESTINATION_RATE_LIMIT_MS = parseInt(process.env.DESTINATION_RATE_LIMIT_MS || '1500', 10);
const MAX_SLEEP_MS = 10000; // Limite de 10s para ambiente serverless

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Pacing Persistente (Check de BD) ───────────────────────────────────────
async function checkPersistentPacing(supabase: any, channelId: string, cooldownMs: number) {
  const { data: lastJob } = await supabase
    .from('send_jobs')
    .select('processed_at')
    .eq('channel_id', channelId)
    .not('processed_at', 'is', null)
    .order('processed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastJob?.processed_at) return { isPaced: true, remainingMs: 0 };

  const lastSent = new Date(lastJob.processed_at).getTime();
  const diff = Date.now() - lastSent;
  const remainingMs = Math.max(0, cooldownMs - diff);
  
  return {
    isPaced: remainingMs === 0,
    remainingMs
  };
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
  const prefix = `[WORKER] [${requestId || 'SYSTEM'}]`;
  if (level === 'ERROR') console.error(prefix, JSON.stringify(entry));
  else if (level === 'WARN') console.warn(prefix, JSON.stringify(entry));
  else console.log(prefix, JSON.stringify(entry));
}

export async function POST(request: Request) {
  const incomingRequestId = request.headers.get('x-request-id');
  const requestId = incomingRequestId || Math.random().toString(36).substring(7);
  const host = request.headers.get('host') || '';
  
  console.log(`[WORKER-START] [${requestId}] Iniciando processamento (Smart Pacing Wait)...`);

  const supabase = createAdminClient();

  try {
    // 1. Autenticação
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;
    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Identificar Canais com Jobs Pendentes
    const { count: totalPendingInitial } = await supabase.from('send_jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending');

    const CHANNELS_PER_BATCH = 15;
    const { data: recentPendingJobs, error: sampleError } = await supabase
      .from('send_jobs')
      .select('channel_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(200);

    if (sampleError) throw new Error(`Fetch jobs error: ${sampleError.message}`);

    const activeChannelIds = [...new Set((recentPendingJobs || []).map(j => j.channel_id))].slice(0, CHANNELS_PER_BATCH);

    console.log(`[WORKER-STATS] [${requestId}] Total Pending: ${totalPendingInitial}, Active Channels found: ${activeChannelIds.length}`);

    if (activeChannelIds.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No pending jobs' });
    }

    const results: any[] = [];
    let processedAny = false;
    let minRemainingMs = Infinity;
    let pacingSkipCount = 0;
    let lockedSkipCount = 0;

    // 3. Processamento Serial por Canal
    for (const channelId of activeChannelIds) {
      const { data: hasLock } = await supabase.rpc('claim_channel_lock', {
        p_channel_id: channelId,
        p_worker_id: requestId,
        p_lock_timeout: '1 minute'
      });

      if (!hasLock) {
        lockedSkipCount++;
        logJob('INFO', 'N/A', { action: 'lock_skip', channelId, reason: 'Busy/Locked' }, requestId);
        continue;
      }

      try {
        const { data: channel } = await supabase.from('channels').select('id, type, name').eq('id', channelId).single();
        if (!channel) continue;
        const channelType = (channel.type as string) || 'whatsapp';
        const provider = getProvider(channelType);
        const pacing = await checkPersistentPacing(supabase, channelId as string, provider.getCooldownMs());

        if (!pacing.isPaced) {
          pacingSkipCount++;
          minRemainingMs = Math.min(minRemainingMs, pacing.remainingMs);
          logJob('INFO', 'N/A', { action: 'pacing_skip', channelId, remaining_cooldown_ms: pacing.remainingMs }, requestId);
          continue;
        }

        const { data: job } = await supabase.from('send_jobs').select('*').eq('channel_id', channelId).eq('status', 'pending').order('created_at', { ascending: true }).limit(1).maybeSingle();
        if (!job) continue;

        const { data: lockedJob } = await supabase.from('send_jobs').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('id', job.id).eq('status', 'pending').select().single();
        if (!lockedJob) continue;

        processedAny = true;
        logJob('INFO', job.id, { action: 'sending', channel: channel.name, destination: job.destination }, requestId);

        try {
          const { data: secretData } = await supabase.from('channel_secrets').select('session_api_key').eq('channel_id', channelId).maybeSingle();
          const apiKey = secretData?.session_api_key;
          if (!apiKey) throw new Error('API Key missing');

          const destination = provider.formatDestination(job.destination);
          const result: SendResult = job.image_url 
            ? await provider.sendMedia(apiKey, destination, job.image_url, job.message_body || '')
            : await provider.sendMessage(apiKey, destination, job.message_body || '');

          if (result.success) {
            await supabase.from('send_jobs').update({ status: 'completed', processed_at: new Date().toISOString(), try_count: job.try_count + 1 }).eq('id', job.id);
            await supabase.from('send_receipts').insert({ send_job_id: job.id, user_id: job.user_id, campaign_id: job.campaign_id, destination: job.destination, wasender_message_id: result.messageId });
            logJob('INFO', job.id, { action: 'delivered' }, requestId);
            results.push({ jobId: job.id, status: 'completed' });
          } else {
            const errorType: ErrorType = result.errorType || provider.classifyError(result.error);
            const finalStatus = (errorType === 'PERMANENT' || job.try_count + 1 >= MAX_RETRIES) ? 'failed' : 'pending';
            await supabase.from('send_jobs').update({ status: finalStatus, error_type: errorType, try_count: job.try_count + 1, last_error: result.error, processed_at: new Date().toISOString() }).eq('id', job.id);
            logJob('WARN', job.id, { action: 'failed', error: result.error, nextStatus: finalStatus }, requestId);
            results.push({ jobId: job.id, status: finalStatus, error: result.error });
          }
        } catch (jobError: any) {
          const errorMessage = jobError.message || 'Unknown pre-send error';
          console.error(`[WORKER-JOB-ERROR] [${requestId}] Job ${job.id}:`, errorMessage);
          
          await supabase.from('send_jobs').update({ 
            status: 'failed', 
            error_type: 'FATAL', 
            last_error: errorMessage,
            processed_at: new Date().toISOString()
          }).eq('id', job.id);
          
          results.push({ jobId: job.id, status: 'failed', error: errorMessage });
        }

      } finally {
        await supabase.rpc('release_channel_lock', { p_channel_id: channelId, p_worker_id: requestId });
      }
    }

    // 4. Agendamento do Próximo Ciclo (Auto-Retrigger)
    const { count: finalPendingCount } = await supabase.from('send_jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending');

    console.log(`[WORKER-BATCH-RESULT] [${requestId}] Processed: ${results.length}, Pacing Skips: ${pacingSkipCount}, Locked Skips: ${lockedSkipCount}, Still Pending: ${finalPendingCount}`);

    if (finalPendingCount && finalPendingCount > 0) {
      let shouldRetrigger = false;
      let triggerMode: 'await' | 'fire-forget' = 'fire-forget';

      if (processedAny) {
        // Se processamos algo, continuamos drenando imediatamente.
        // MUDANÇA: Usamos fire-forget para não acumular execução na Vercel (evitar timeout em cadeia).
        shouldRetrigger = true;
        triggerMode = 'fire-forget';
      } else if (pacingSkipCount > 0 && minRemainingMs !== Infinity) {
        // Nada enviado, apenas pulado por pacing. Aguardar o cooldown restante (com limite seguro)
        const waitMs = Math.min(minRemainingMs, MAX_SLEEP_MS);
        console.log(`[WORKER-WAIT] [${requestId}] Nada elegível no momento. Aguardando ${waitMs}ms de cooldown...`);
        await sleep(waitMs);
        shouldRetrigger = true;
        triggerMode = 'fire-forget';
      } else {
        console.log(`[WORKER-IDLE] [${requestId}] Jobs pendentes mas nenhum elegível (todos bloqueados). Aguardando Heartbeat.`);
        shouldRetrigger = false;
      }

      if (shouldRetrigger) {
        console.log(`[WORKER-DECISION] [${requestId}] Status: RETRIGGER (${triggerMode}).`);
        
        // Dispara o próximo ciclo.
        // Como o worker agora sempre usa fire-forget para auto-retrigger evitaremos timeouts em cadeia.
        const triggerPromise = triggerWorker({ 
          host, 
          requestId: `next-${requestId.slice(0,5)}`,
          shouldAwait: false 
        });

        // Não aguardamos o resultado para retornar logo o 200 pro worker anterior ou heartbeat
        triggerPromise.catch(e => console.error(`[WORKER-TRIGGER-ERROR] [${requestId}]`, e));
      } else {
        console.log(`[WORKER-DECISION] [${requestId}] Status: STOP (Idle/Blocked).`);
      }
    } else {
        console.log(`[WORKER-DECISION] [${requestId}] Status: FINISHED (Queue empty).`);
    }

    return NextResponse.json({ 
      processed: results.length, 
      remaining: finalPendingCount || 0, 
      requestId,
      batch: {
        processed: results.length,
        pacingSkips: pacingSkipCount,
        lockedSkips: lockedSkipCount
      }
    });

  } catch (error: any) {
    console.error(`[WORKER-FATAL] [${requestId}]`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
