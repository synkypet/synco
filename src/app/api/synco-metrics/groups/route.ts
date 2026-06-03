import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canUseSyncoMetrics, SYNCO_METRICS_LIMIT } from '@/lib/synco-metrics';

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

    // Buscar os grupos do usuário com join para ver se estão no sm_monitored_groups
    // Note: O Supabase JS builder permite joins se a foreign key estiver configurada.
    // Como sm_monitored_groups tem FK pra groups(id), podemos usar foreign table syntax.
    
    // Contudo, para um select com left join "customizado" (groups -> sm_monitored_groups)
    // Onde 1 grupo pode ter 1 ou 0 monitores ativos (is_deleted = false)
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select(`
        id,
        name,
        remote_id,
        channel_id,
        sm_monitored_groups (
          id,
          enabled,
          is_deleted,
          last_snapshot_at,
          last_poll_status
        )
      `)
      .eq('user_id', user.id);

    if (groupsError) {
      throw groupsError;
    }

    // Filtra apenas os sm_monitored_groups que não estão deletados logicamente
    // E mapeia para um formato mais fácil pro frontend
    let activeCount = 0;
    
    const mappedGroups = (groups || []).map(g => {
      // Como pode retornar array (se supabase achar q eh 1:N), lidamos com isso.
      const smDataArray = Array.isArray(g.sm_monitored_groups) ? g.sm_monitored_groups : (g.sm_monitored_groups ? [g.sm_monitored_groups] : []);
      const activeMonitor = smDataArray.find((m: any) => m.is_deleted === false);
      
      if (activeMonitor && activeMonitor.enabled) {
        activeCount++;
      }

      return {
        id: g.id,
        name: g.name || 'Grupo sem nome',
        channel_id: g.channel_id,
        remote_id: g.remote_id,
        monitor_id: activeMonitor?.id || null,
        is_monitored: activeMonitor ? activeMonitor.enabled : false,
        last_poll_status: activeMonitor?.last_poll_status || null,
        last_snapshot_at: activeMonitor?.last_snapshot_at || null,
      };
    });

    return NextResponse.json({
      groups: mappedGroups,
      limit: SYNCO_METRICS_LIMIT,
      activeCount
    });

  } catch (error: any) {
    console.error('[SYNCOMETRICS-GROUPS]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
