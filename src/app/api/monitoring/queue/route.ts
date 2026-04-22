// src/app/api/monitoring/queue/route.ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient();
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Automações de Grupos (group_monitor)
    const { data: groupSources } = await supabase
      .from('automation_sources')
      .select(`
        id, name, is_active, source_type, created_at,
        automation_routes ( id, target_type, target_id, is_active )
      `)
      .eq('user_id', userId)
      .eq('source_type', 'group_monitor')
      .order('created_at', { ascending: false });

    // 2. Automações do Radar (radar_offers)
    const { data: radarSources } = await supabase
      .from('automation_sources')
      .select(`
        id, name, is_active, source_type, created_at,
        automation_routes ( id, target_type, target_id, is_active )
      `)
      .eq('user_id', userId)
      .eq('source_type', 'radar_offers')
      .order('created_at', { ascending: false });

    // 3. Jobs na fila por status (para calcular posições)
    const { data: pendingJobs } = await supabase
      .from('send_jobs')
      .select('id, campaign_id, status, created_at, destination, channel_id')
      .eq('user_id', userId)
      .in('status', ['pending', 'processing'])
      .order('created_at', { ascending: true })
      .limit(100);

    // 4. Campanhas ativas (ligando à fila)
    const { data: activeCampaigns } = await supabase
      .from('campaigns')
      .select('id, name, status, created_at, total_destinations')
      .eq('user_id', userId)
      .in('status', ['sending', 'pending'])
      .order('created_at', { ascending: false })
      .limit(20);

    // 5. Logs recentes de automação (últimas 24h)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentLogs } = await supabase
      .from('automation_logs')
      .select('id, source_id, status, event_type, details, created_at')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(50);

    // Montar posições na fila por campaign_id
    const queuePositions: Record<string, number> = {};
    (pendingJobs || []).forEach((job, index) => {
      if (job.campaign_id && !queuePositions[job.campaign_id]) {
        queuePositions[job.campaign_id] = index + 1;
      }
    });

    return NextResponse.json({
      groupSources: groupSources || [],
      radarSources: radarSources || [],
      pendingJobs: pendingJobs || [],
      activeCampaigns: activeCampaigns || [],
      recentLogs: recentLogs || [],
      queuePositions,
      totalPending: pendingJobs?.length || 0,
    });

  } catch (error: any) {
    console.error('[MONITORING-QUEUE] Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
