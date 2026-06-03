import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canUseSyncoMetrics } from '@/lib/synco-metrics';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasAccess = await canUseSyncoMetrics(user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Plano não permite uso do SyncoMetrics' }, { status: 403 });
    }

    // Retorna um resumo macro
    const { count: activeMonitors } = await supabase
      .from('sm_monitored_groups')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('enabled', true)
      .eq('is_deleted', false);

    // Como não há worker ainda, retornamos nulos controlados.
    return NextResponse.json({
      active_monitors: activeMonitors || 0,
      last_snapshot_at: null,
      growth_24h: null,
      last_poll_status: "Aguardando início do worker SyncoMetrics",
      status_code: 'waiting_worker'
    });

  } catch (error: any) {
    console.error('[SYNCOMETRICS-SUMMARY]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
