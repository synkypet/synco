// src/app/api/send-jobs/process/route.ts
// Worker de fila v3 — Atomic Channel Locking & Persistent Pacing
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProvider } from '@/lib/providers/factory';
import { triggerWorker } from '@/lib/worker/trigger';
import type { SendResult, ErrorType } from '@/lib/providers/types';

// ─── Configuração Global ────────────────────────────────────────────────────
const MAX_RETRIES = parseInt(process.env.SEND_MAX_RETRIES || '3', 10);
const DESTINATION_RATE_LIMIT_MS = parseInt(process.env.DESTINATION_RATE_LIMIT_MS || '1500', 10);

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Rate Limit por Destino (Map em memória — Destinos são globais, canais são individuais) ───
const destinationLastSent = new Map<string, number>();

function canSendToDestination(destination: string): boolean {
  const lastSent = destinationLastSent.get(destination);
  if (!lastSent) return true;
  return (Date.now() - lastSent) >= DESTINATION_RATE_LIMIT_MS;
}

function markDestinationSent(destination: string) {
  destinationLastSent.set(destination, Date.now());
}

// ─── Pacing Persistente (Check de BD) ───────────────────────────────────────
async function checkPersistentPacing(supabase: any, channelId: string, cooldownMs: number): Promise<boolean> {
  // Busca o timestamp do último job processado com sucesso/finalizado para este canal
  const { data: lastJob } = await supabase
    .from('send_jobs')
    .select('processed_at')
    .eq('channel_id', channelId)
    .not('processed_at', 'is', null)
    .order('processed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastJob?.processed_at) return true;

  const lastSent = new Date(lastJob.processed_at).getTime();
  const diff = Date.now() - lastSent;
  
  return diff >= cooldownMs;
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
  
  console.log(`[WORKER-START] [${requestId}] Iniciando processamento (Serialização por Canal)...`);

  const supabase = createAdminClient();

  try {
    // ─── 1. Autenticação ─────────────────────────────────────────────────
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ─── 2. Identificar Canais com Jobs Pendentes ─────────────────────────
    const CHANNELS_PER_BATCH = 15;
    
    // Lista canais distintos que possuem jobs 'pending'
    const { data: recentPendingJobs, error: sampleError } = await supabase
      .from('send_jobs')
      .select('channel_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(200);

    if (sampleError) throw new Error(`Fetch jobs error: ${sampleError.message}`);

    const activeChannelIds = [...new Set((recentPendingJobs || []).map(j => j.channel_id))]
      .slice(0, CHANNELS_PER_BATCH);

    if (activeChannelIds.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No pending jobs' });
    }

    const results: any[] = [];
    let processedAny = false;

    // ─── 3. Processamento Serial por Canal ────────────────────────────────
    for (const channelId of activeChannelIds) {
      // 3.1 Lock Atômico por Canal
      const { data: hasLock } = await supabase.rpc('claim_channel_lock', {
        p_channel_id: channelId,
        p_worker_id: requestId,
        p_lock_timeout: '1 minute'
      });

      if (!hasLock) {
        logJob('INFO', 'N/A', { action: 'lock_skip', channelId, reason: 'Busy or locked by another worker' }, requestId);
        continue;
      }

      try {
        // 3.2 Verificar Pacing (BD)
        // Precisamos do channel config para saber o cooldown
        const { data: channel } = await supabase
          .from('channels')
          .select('id, type, name, config')
          .eq('id', channelId)
          .single();

        if (!channel) continue;
        
        const provider = getProvider(channel.type || 'whatsapp');
        const isPaced = await checkPersistentPacing(supabase, channelId, provider.getCooldownMs());

        if (!isPaced) {
          logJob('INFO', 'N/A', { action: 'pacing_skip', channelId, name: channel.name }, requestId);
          continue;
        }

        // 3.3 Buscar 1 único job para este canal
        const { data: job } = await supabase
          .from('send_jobs')
          .select('*')
          .eq('channel_id', channelId)
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!job) continue;

        // 3.4 Lock do Job
        const { data: lockedJob } = await supabase
          .from('send_jobs')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', job.id)
          .eq('status', 'pending')
          .select()
          .single();

        if (!lockedJob) continue;

        // 3.5 Processar Envio
        processedAny = true;
        logJob('INFO', job.id, { action: 'sending', channel: channel.name, destination: job.destination }, requestId);

        // Resolver segredos
        const { data: secretData } = await supabase
          .from('channel_secrets')
          .select('session_api_key')
          .eq('channel_id', channelId)
          .maybeSingle();

        const apiKey = secretData?.session_api_key;
        if (!apiKey) throw new Error('API Key missing');

        // Formatação e Envio
        const destination = provider.formatDestination(job.destination);
        const result: SendResult = job.image_url 
          ? await provider.sendMedia(apiKey, destination, job.image_url, job.message_body || '')
          : await provider.sendMessage(apiKey, destination, job.message_body || '');

        // 3.6 Finalizar Job
        if (result.success) {
          await supabase.from('send_jobs').update({
            status: 'completed',
            processed_at: new Date().toISOString(),
            try_count: job.try_count + 1
          }).eq('id', job.id);

          await supabase.from('send_receipts').insert({
            send_job_id: job.id,
            user_id: job.user_id,
            campaign_id: job.campaign_id,
            destination: job.destination,
            wasender_message_id: result.messageId
          });

          logJob('INFO', job.id, { action: 'delivered' }, requestId);
          results.push({ jobId: job.id, status: 'completed' });
        } else {
          const errorType: ErrorType = result.errorType || provider.classifyError(result.error);
          const finalStatus = (errorType === 'PERMANENT' || job.try_count + 1 >= MAX_RETRIES) ? 'failed' : 'pending';
          
          await supabase.from('send_jobs').update({
            status: finalStatus,
            error_type: errorType,
            try_count: job.try_count + 1,
            last_error: result.error,
            processed_at: new Date().toISOString()
          }).eq('id', job.id);

          logJob('WARN', job.id, { action: 'failed', error: result.error, nextStatus: finalStatus }, requestId);
          results.push({ jobId: job.id, status: finalStatus, error: result.error });
        }

      } finally {
        // 3.7 Liberar Lock do Canal
        await supabase.rpc('release_channel_lock', {
          p_channel_id: channelId,
          p_worker_id: requestId
        });
      }
    }

    // ─── 4. Auto-Retrigger (Se houver mais pendentes) ─────────────────────
    const { count } = await supabase
      .from('send_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (count && count > 0) {
      console.log(`[WORKER-RETRIGGER] [${requestId}] Ainda existem ${count} jobs pendentes. Agendando próximo ciclo...`);
      // Disparo Fire-and-Forget
      triggerWorker({ host, requestId: `next-${requestId.slice(0,5)}` });
    }

    return NextResponse.json({
      processed: results.length,
      remaining: count || 0,
      requestId
    });

  } catch (error: any) {
    console.error(`[WORKER-FATAL] [${requestId}]`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
