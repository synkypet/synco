import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { triggerWorker } from '@/lib/worker/trigger';
import { waitUntil } from '@vercel/functions';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get('campaign_id');
  const rid = `nudge-${Math.random().toString(36).substring(7)}`;

  if (!campaignId) {
    return NextResponse.json({ error: 'Missing campaign_id' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    let nudgeAttempted = false;

    // 1. Buscar o canal e created_at do primeiro job pending desta campanha
    const { data: campaignJobs } = await supabase
      .from('send_jobs')
      .select('id, channel_id, created_at, status')
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: true })
      .limit(1);

    const firstJob = campaignJobs?.[0];

    if (!firstJob) {
      // Nenhum job active — campanha finalizada
      return NextResponse.json({ position: 0, pendingInCampaign: 0, channelId: null, operationalStatus: 'completed', nudgeAttempted: false });
    }

    // ─── LÓGICA DE AUTO-NUDGE (Despertar da Fila) ───────────────────────────
    // Se o job desta campanha está 'pending', vamos conferir a saúde global da fila.
    if (firstJob.status === 'pending') {
      // 1. Verificar se existe algum processo ATIVO e RECENTE no sistema
      const { data: recentProcessing } = await supabase
        .from('send_jobs')
        .select('updated_at')
        .eq('status', 'processing')
        .order('updated_at', { ascending: false })
        .limit(1);

      const isStalled = !recentProcessing || recentProcessing.length === 0 || 
        (Date.now() - new Date(recentProcessing[0].updated_at).getTime() > 60000); // 60s de silêncio

      if (isStalled) {
        // 2. Tentar adquirir lock para evitar tempestade de triggers (Debounce de 60s)
        const { data: hasLock } = await supabase.rpc('claim_maintenance_lock', {
          p_lock_key: 'auto_nudge_debounce',
          p_worker_id: rid,
          p_timeout_seconds: 60
        });

        if (hasLock) {
          console.log(`[AUTO-NUDGE] [${rid}] Fila estagnada detectada. Acordando worker...`);
          nudgeAttempted = true;
          const host = request.headers.get('host') || undefined;
          
          // Disparo seguro em background
          waitUntil(triggerWorker({ 
            requestId: rid, 
            host, 
            source: 'auto-nudge',
            shouldAwait: false 
          }));
        }
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    // Se o primeiro job está em processing, está enviando agora
    if (firstJob.status === 'processing') {
      const { count: pendingCount } = await supabase
        .from('send_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .in('status', ['pending', 'processing']);

      return NextResponse.json({
        position: 1,
        pendingInCampaign: pendingCount || 1,
        channelId: firstJob.channel_id,
        operationalStatus: 'sending',
        nudgeAttempted
      });
    }

    // 2. Contar quantos jobs pending de OUTROS campaigns existem no mesmo canal antes deste
    const { count: jobsAhead } = await supabase
      .from('send_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('channel_id', firstJob.channel_id)
      .eq('status', 'pending')
      .neq('campaign_id', campaignId)
      .lt('created_at', firstJob.created_at);

    // 3. Contar total de pending desta campanha
    const { count: pendingInCampaign } = await supabase
      .from('send_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('status', 'pending');

    // 4. Buscar o último job processado no canal para calcular cooldown/ETA real
    const { data: lastProcessedJob } = await supabase
      .from('send_jobs')
      .select('processed_at')
      .eq('channel_id', firstJob.channel_id)
      .not('processed_at', 'is', null)
      .order('processed_at', { ascending: false })
      .limit(1);

    const position = (jobsAhead || 0) + 1;
    const operationalStatus = position === 1 ? 'cooldown' : 'queued';

    return NextResponse.json({
      position,
      pendingInCampaign: pendingInCampaign || 0,
      channelId: firstJob.channel_id,
      operationalStatus,
      lastProcessedAt: lastProcessedJob?.[0]?.processed_at || null,
      nudgeAttempted
    });

  } catch (error: any) {
    console.error('[QUEUE-POSITION] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
