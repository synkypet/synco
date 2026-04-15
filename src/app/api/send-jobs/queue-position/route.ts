// src/app/api/send-jobs/queue-position/route.ts
// Retorna a posição na fila de um conjunto de jobs de uma campanha,
// calculado por canal (respeitando o pacing real do worker).
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get('campaign_id');

  if (!campaignId) {
    return NextResponse.json({ error: 'Missing campaign_id' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

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
      return NextResponse.json({ position: 0, pendingInCampaign: 0, channelId: null, operationalStatus: 'completed' });
    }

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

    const position = (jobsAhead || 0) + 1;
    const operationalStatus = position === 1 ? 'cooldown' : 'queued';

    return NextResponse.json({
      position,
      pendingInCampaign: pendingInCampaign || 0,
      channelId: firstJob.channel_id,
      operationalStatus,
    });

  } catch (error: any) {
    console.error('[QUEUE-POSITION] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
