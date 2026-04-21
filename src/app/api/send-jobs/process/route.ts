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

    // --- ETAPA 3: GARBAGE COLLECTOR DE JOBS ZUMBIS ---
    // Resgata jobs presos em 'processing' há mais de 5 minutos (crash/timeout do worker serverless)
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: resurrected } = await supabase
      .from('send_jobs')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .eq('status', 'processing')
      .lte('updated_at', staleThreshold)
      .select('id');
      
    if (resurrected && resurrected.length > 0) {
      console.warn(`[WORKER-GC] [${requestId}] Ressuscitou ${resurrected.length} jobs zumbis presos em processing.`);
    }

    // 2. Identificar Canais com Jobs Pendentes
    const { count: totalPendingInitial } = await supabase.from('send_jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending');

    const CHANNELS_PER_BATCH = 8; // Reduzido para maior segurança em serverless (FRENTE 4)
    const WORKER_DEADLINE_MS = 45000; // 45 segundos de teto operacional
    const startTime = Date.now();

    // Controle de profundidade de retrigger (Anti-loop 508)
    const incomingDepth = parseInt(request.headers.get('x-worker-depth') || '0', 10);
    const currentDepth = incomingDepth;
    const MAX_DEPTH = 3;

    const { data: recentPendingJobs, error: sampleError } = await supabase
      .from('send_jobs')
      .select('channel_id')
      .eq('status', 'pending')
      .order('updated_at', { ascending: true })
      .limit(200);

    if (sampleError) throw new Error(`Fetch jobs error: ${sampleError.message}`);

    const activeChannelIds = [...new Set((recentPendingJobs || []).map(j => j.channel_id))].slice(0, CHANNELS_PER_BATCH);

    console.log(`[WORKER-STATS] [${requestId}] Depth: ${currentDepth}, Pending: ${totalPendingInitial}, Batch: ${activeChannelIds.length}`);

    if (activeChannelIds.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No pending jobs', depth: currentDepth });
    }

    const results: any[] = [];
    let processedAny = false;
    let pacingSkipCount = 0;
    let lockedSkipCount = 0;
    let deadlineReached = false;

    // 3. Processamento Serial por Canal
    for (const channelId of activeChannelIds) {
      // Check de Deadline operacional
      const elapsed = Date.now() - startTime;
      if (elapsed > WORKER_DEADLINE_MS) {
        console.warn(`[WORKER-DEADLINE] [${requestId}] Atingido limite de 45s. Encerrando batch prematuramente.`);
        deadlineReached = true;
        break;
      }

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
          logJob('INFO', 'N/A', { action: 'pacing_skip', channelId, remaining_cooldown_ms: pacing.remainingMs }, requestId);
          continue;
        }

        const { data: job } = await supabase.from('send_jobs').select('*').eq('channel_id', channelId).eq('status', 'pending').order('updated_at', { ascending: true }).limit(1).maybeSingle();
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
            const errorType: string = result.errorType || provider.classifyError(result.error);
            
            // --- ETAPA 1: TRATAMENTO DE PERDA DE SESSÃO ---
            if (errorType === 'SESSION_LOST') {
              console.warn(`[WORKER-SESSION-LOST] [${requestId}] Sessão do canal ${channelId} perdida. Pausando fila.`);
              
              // 1. Marca o job atual como session_lost
              await supabase.from('send_jobs').update({ 
                status: 'session_lost', 
                error_type: 'SESSION_LOST', 
                last_error: 'Sessão WhatsApp Desconectada', 
                processed_at: new Date().toISOString() 
              }).eq('id', job.id);
              
              // 2. Pausa imediatamente todos os outros jobs pendentes deste canal para evitar queima da fila
              await supabase.from('send_jobs').update({ 
                status: 'session_lost', 
                error_type: 'SESSION_LOST', 
                last_error: 'Fila pausada: Sessão WhatsApp Desconectada',
                updated_at: new Date().toISOString()
              }).eq('channel_id', channelId).eq('status', 'pending');
              
              logJob('WARN', job.id, { action: 'paused_channel', reason: 'session_lost' }, requestId);
              results.push({ jobId: job.id, status: 'session_lost', error: result.error });
              
              // 3. Abandona o processamento deste canal
              break; // Sai do try/catch, vai para o finally (libera lock) e passa para o próximo canal do batch
            }

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

    // 4. Agendamento do Próximo Ciclo (Auto-Retrigger Controlado)
    const { count: finalPendingCount } = await supabase.from('send_jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending');

    console.log(`[WORKER-BATCH-RESULT] [${requestId}] Processed: ${results.length}, Pending: ${finalPendingCount}, Deadline: ${deadlineReached}`);

    if (finalPendingCount && finalPendingCount > 0) {
      let shouldRetrigger = false;
      let stopReason = '';

      if (currentDepth >= MAX_DEPTH) {
        shouldRetrigger = false;
        stopReason = 'MAX_DEPTH_REACHED';
      } else if (deadlineReached) {
        // Se parou por deadline, forçamos um retrigger imediato para o próximo batch continuar
        shouldRetrigger = true;
      } else if (processedAny) {
        // Se processou algo nesta rodada, continua drenando
        shouldRetrigger = true;
      } else {
        // Se não processou nada (ex: tudo em cooldown/lock), não re-dispara.
        // O Heartbeat cuidará de retomar no futuro. Isso evita loops de 508.
        shouldRetrigger = false;
        stopReason = 'CONGESTION_IDLE';
      }

      if (shouldRetrigger) {
        console.log(`[WORKER-DECISION] [${requestId}] Status: RETRIGGER (Next Depth: ${currentDepth + 1}).`);
        
        triggerWorker({ 
          host, 
          requestId: `next-${requestId.slice(0,5)}`,
          shouldAwait: false,
          depth: currentDepth + 1,
          source: 'autoretrigger'
        });
      } else {
        console.log(`[WORKER-DECISION] [${requestId}] Status: STOP (${stopReason}).`);
      }
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
