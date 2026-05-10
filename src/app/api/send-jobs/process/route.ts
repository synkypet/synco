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

function isWithinSendWindow(
  windowStart: string | null, 
  windowEnd: string | null, 
  timezone: string
): boolean {
  if (!windowStart || !windowEnd) return true;
  
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', { 
      timeZone: timezone, 
      hour: 'numeric', 
      minute: 'numeric', 
      hour12: false 
    });
    const parts = formatter.formatToParts(now);
    const hourStr = parts.find(p => p.type === 'hour')?.value;
    const minStr = parts.find(p => p.type === 'minute')?.value;
    if (!hourStr || !minStr) return true;
    
    const h = parseInt(hourStr, 10);
    const h24 = h === 24 ? 0 : h;
    const currentTime = `${h24.toString().padStart(2, '0')}:${minStr.padStart(2, '0')}`;
    
    return currentTime >= windowStart && currentTime <= windowEnd;
  } catch (e) {
    console.error('[WORKER] Error checking send window:', e);
    return true;
  }
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
function logJob(level: 'INFO' | 'ERROR' | 'WARN', jobId: string, data: Record<string, any>, requestId?: string, userId?: string, origin?: string) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    jobId,
    reqId: requestId,
    origin,
    ...data,
  };
  const userTag = userId ? `[USER:${userId.substring(0,8)}] ` : '';
  const prefix = `[WORKER] ${userTag}[REQ:${requestId || 'SYSTEM'}]`;
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

    // 2. Identificar Canais com Jobs Pendentes (Round-Robin Fairness)
    // Buscamos uma amostra maior para garantir que usuários novos/menores não sejam sufocados por grandes volumes
    const SAMPLE_SIZE = 1000;
    const { data: recentPendingJobs, error: sampleError } = await supabase
      .from('send_jobs')
      .select('id, channel_id, user_id, origin')
      .eq('status', 'pending')
      .or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`)
      .order('updated_at', { ascending: true })
      .limit(SAMPLE_SIZE);

    if (sampleError) throw new Error(`Fetch jobs error: ${sampleError.message}`);

    // Agrupamento por usuário para Interleaving (Round-Robin)
    const channelsByUser = new Map<string, string[]>();
    (recentPendingJobs || []).forEach(job => {
      const userChans = channelsByUser.get(job.user_id) || [];
      if (!userChans.includes(job.channel_id)) {
        userChans.push(job.channel_id);
        channelsByUser.set(job.user_id, userChans);
      }
    });

    // Algoritmo de Interleaving: Pegamos um canal de cada usuário por rodada
    const activeChannelIds: string[] = [];
    const userOrder = Array.from(channelsByUser.keys()); // Mantém ordem FIFO dos usuários baseada no job mais antigo
    
    let hasMore = true;
    let round = 0;
    while (activeChannelIds.length < CHANNELS_PER_BATCH && hasMore) {
      hasMore = false;
      for (const userId of userOrder) {
        const userChans = channelsByUser.get(userId)!;
        if (userChans.length > round) {
          const channelId = userChans[round];
          if (!activeChannelIds.includes(channelId)) {
            activeChannelIds.push(channelId);
            if (activeChannelIds.length >= CHANNELS_PER_BATCH) break;
          }
          hasMore = true;
        }
      }
      round++;
    }

    // Buscar configs de janela de horário para os usuários ativos
    const { data: userConfigs } = await supabase
      .from('automation_sources')
      .select('user_id, config')
      .eq('source_type', 'radar_offers')
      .eq('is_active', true)
      .in('user_id', userOrder);

    const userWindows = new Map<string, any>();
    (userConfigs || []).forEach(src => {
      const config = src.config as any;
      if (config?.send_window_start && config?.send_window_end) {
        userWindows.set(src.user_id, {
          start: config.send_window_start,
          end: config.send_window_end,
          tz: config.send_window_timezone || 'America/Sao_Paulo'
        });
      }
    });

    console.log(`[WORKER-STATS] [${requestId}] Depth: ${currentDepth}, Pending: ${totalPendingInitial}, Sample: ${recentPendingJobs?.length}, Users: ${userOrder.length}, Batch: ${activeChannelIds.length}`);

    // Logs Específicos para Diagnóstico de Fila (Fase 4)
    console.log(`[WORKER-CRON] Ciclo iniciado. Jobs pendentes: ${totalPendingInitial} total`);
    if (recentPendingJobs && recentPendingJobs.length > 0) {
      const userCounts = recentPendingJobs.reduce((acc: any, job: any) => {
        const u = `[USER:${job.user_id.substring(0,8)}]`;
        acc[u] = (acc[u] || 0) + 1;
        return acc;
      }, {});
      const countsStr = Object.entries(userCounts).map(([u, c]) => `${u}=${c}`).join(', ');
      console.log(`[WORKER-CRON] Distribuição na amostra de ${SAMPLE_SIZE}: ${countsStr}`);
      console.log(`[WORKER-CRON] Canais selecionados para este batch: ${activeChannelIds.join(', ')}`);
    }

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
      // Identifica o user_id deste canal para checar a janela de horário
      let channelUserId = null;
      for (const [uid, chans] of channelsByUser.entries()) {
        if (chans.includes(channelId)) {
          channelUserId = uid;
          break;
        }
      }

      if (channelUserId && userWindows.has(channelUserId)) {
        const win = userWindows.get(channelUserId);
        if (!isWithinSendWindow(win.start, win.end, win.tz)) {
          const formatter = new Intl.DateTimeFormat('en-US', { timeZone: win.tz, hour: '2-digit', minute: '2-digit', hour12: false });
          const currentTime = formatter.format(new Date());
          console.log(`[SEND-WINDOW-SKIP] userId:${channelUserId} window:${win.start}-${win.end} currentTime:${currentTime}`);
          continue; // Pula todos os jobs desse canal (continuam pending)
        }
      }

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

        const { data: job } = await supabase.from('send_jobs').select('*').eq('channel_id', channelId).eq('status', 'pending').or(`scheduled_at.is.null,scheduled_at.lte.${new Date().toISOString()}`).order('updated_at', { ascending: true }).limit(1).maybeSingle();
        if (!job) continue;

        const { data: lockedJob } = await supabase.from('send_jobs').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('id', job.id).eq('status', 'pending').select().single();
        if (!lockedJob) continue;

        processedAny = true;
        const userTagJob = `[USER:${job.user_id.substring(0,8)}]`;
        console.log(`[WORKER-CRON] Selecionado: [JOB:${job.id.substring(0,8)}] ${userTagJob} [ORIGIN:${job.origin}] (primeiro da fila pendente no canal)`);
        logJob('INFO', job.id, { action: 'sending', channel: channel.name, destination: job.destination }, requestId, job.user_id, job.origin);

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
            logJob('INFO', job.id, { action: 'delivered' }, requestId, job.user_id, job.origin);
            results.push({ jobId: job.id, status: 'completed', origin: job.origin });
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
              
              logJob('WARN', job.id, { action: 'paused_channel', reason: 'session_lost' }, requestId, job.user_id, job.origin);
              results.push({ jobId: job.id, status: 'session_lost', error: result.error, origin: job.origin });
              
              // 3. Abandona o processamento deste canal
              break; // Sai do try/catch, vai para o finally (libera lock) e passa para o próximo canal do batch
            }

            const finalStatus = (errorType === 'PERMANENT' || job.try_count + 1 >= MAX_RETRIES) ? 'failed' : 'pending';
            await supabase.from('send_jobs').update({ status: finalStatus, error_type: errorType, try_count: job.try_count + 1, last_error: result.error, processed_at: new Date().toISOString() }).eq('id', job.id);
            logJob('WARN', job.id, { action: 'failed', error: result.error, nextStatus: finalStatus }, requestId, job.user_id, job.origin);
            results.push({ jobId: job.id, status: finalStatus, error: result.error, origin: job.origin });
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
          
          logJob('ERROR', job.id, { action: 'fatal_error', error: errorMessage }, requestId, job.user_id, job.origin);
          results.push({ jobId: job.id, status: 'failed', error: errorMessage, origin: job.origin });
        }

        try {
          await supabase.rpc('check_and_close_campaign', { p_campaign_id: job.campaign_id });
        } catch (closeError) {
          console.error(`[WORKER-SYNC] Failed to close campaign ${job.campaign_id}:`, closeError);
        }

      } finally {
        await supabase.rpc('release_channel_lock', { p_channel_id: channelId, p_worker_id: requestId });
      }
    }

    // 4. Agendamento do Próximo Ciclo (Auto-Retrigger Controlado)
    const { count: finalPendingCount } = await supabase.from('send_jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending');

    // ─── Log de Resumo de Batch (Observabilidade por Origem) ──────────────────
    const originCounts = results.reduce((acc: Record<string, number>, r: any) => {
      const o = r.origin || 'unknown';
      acc[o] = (acc[o] || 0) + 1;
      return acc;
    }, {});
    const originsStr = Object.entries(originCounts).map(([o, c]) => `${o}:${c}`).join(' ');
    console.log(`[WORKER-BATCH-RESULT] [${requestId}] total:${results.length} ${originsStr} | Pending: ${finalPendingCount}, Deadline: ${deadlineReached}`);

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
