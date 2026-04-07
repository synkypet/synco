// src/app/api/send-jobs/process/route.ts
// Worker de fila — consome send_jobs pendentes e envia via Wasender com pacing e idempotência.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { WasenderClient } from '@/lib/wasender/client';

// ─── Configuração de Pacing ────────────────────────────────────────────────
const BATCH_SIZE = parseInt(process.env.SEND_BATCH_SIZE || '5', 10);
const COOLDOWN_BETWEEN_MSGS_MS = parseInt(process.env.SEND_COOLDOWN_MS || '3000', 10);
const MAX_RETRIES = parseInt(process.env.SEND_MAX_RETRIES || '3', 10);

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient();

    // ─── 1. Autenticação / Proteção ────────────────────────────────────────
    // Em produção, essa rota deve ser protegida por um secret header (CRON_SECRET)
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ─── 2. Buscar jobs pendentes ──────────────────────────────────────────
    const { data: jobs, error: fetchError } = await supabase
      .from('send_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      throw new Error(`Failed to fetch jobs: ${fetchError.message}`);
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No pending jobs' });
    }

    const results: { jobId: string; status: string; error?: string }[] = [];

    for (const job of jobs) {
      // ─── 3. Marcar como "processing" (lock otimista) ───────────────────
      await supabase
        .from('send_jobs')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', job.id)
        .eq('status', 'pending'); // Condição para evitar race condition

      // ─── 4. Verificar idempotência ─────────────────────────────────────
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
          // Já foi enviado antes — marcar como duplicado/completado
          await supabase
            .from('send_jobs')
            .update({
              status: 'completed',
              last_error: 'Skipped: duplicate (idempotency)',
              processed_at: new Date().toISOString()
            })
            .eq('id', job.id);

          results.push({ jobId: job.id, status: 'skipped_duplicate' });
          continue;
        }
      }

      // ─── 5. Verificar status da sessão antes de enviar ─────────────────
      try {
        // Checar se a sessão ainda está conectada buscando o canal
        const { data: channel } = await supabase
          .from('channels')
          .select('config')
          .eq('id', job.channel_id)
          .single();

        const sessionStatus = channel?.config?.status;
        if (sessionStatus === 'session_lost' || sessionStatus === 'disconnected') {
          await supabase
            .from('send_jobs')
            .update({
              status: 'failed',
              last_error: `Session unavailable: ${sessionStatus}`,
              try_count: job.try_count + 1,
              processed_at: new Date().toISOString()
            })
            .eq('id', job.id);

          results.push({ jobId: job.id, status: 'failed', error: `session_${sessionStatus}` });
          continue;
        }
      } catch {
        // Se não conseguimos checar, tentamos enviar assim mesmo
      }

      // ─── 6. Enviar mensagem via Wasender ───────────────────────────────
      try {
        let response;
        const messageText = job.message_body || '';

        // Se houver imagem, envia imagem com legenda (caption)
        if (job.image_url) {
          response = await WasenderClient.sendImage(
            job.session_id,
            job.destination,
            job.image_url,
            messageText
          );
        } else {
          // Apenas texto
          response = await WasenderClient.sendMessage(
            job.session_id,
            job.destination,
            messageText
          );
        }

        const messageId = response?.message_id || response?.id || response?.data?.id || null;

        // Marcar job como completado
        await supabase
          .from('send_jobs')
          .update({
            status: 'completed',
            processed_at: new Date().toISOString(),
            try_count: job.try_count + 1
          })
          .eq('id', job.id);

        // Criar recibo de entrega
        await supabase
          .from('send_receipts')
          .insert({
            send_job_id: job.id,
            user_id: job.user_id,
            campaign_id: job.campaign_id,
            campaign_item_id: job.campaign_item_id || null,
            destination: job.destination,
            status: 'delivered',
            wasender_message_id: messageId,
            delivered_at: new Date().toISOString()
          });

        results.push({ jobId: job.id, status: 'completed' });

      } catch (sendError: any) {
        const newTryCount = job.try_count + 1;
        const finalStatus = newTryCount >= MAX_RETRIES ? 'failed' : 'pending'; // Volta pra fila se ainda tem retries

        await supabase
          .from('send_jobs')
          .update({
            status: finalStatus,
            try_count: newTryCount,
            last_error: sendError.message,
            processed_at: new Date().toISOString()
          })
          .eq('id', job.id);

        results.push({ jobId: job.id, status: finalStatus, error: sendError.message });
      }

      // ─── 7. Cooldown entre mensagens ───────────────────────────────────
      await sleep(COOLDOWN_BETWEEN_MSGS_MS);
    }

    return NextResponse.json({
      processed: results.length,
      results
    });

  } catch (error: any) {
    console.error('Send Jobs Process Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
