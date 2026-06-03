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

    // 1. Buscar monitores ativos com dados limitados e join manual em groups
    const { data: monitoredGroups, error: monitorsError } = await supabase
      .from('sm_monitored_groups')
      .select('id, group_id, channel_id, enabled, last_snapshot_at, last_poll_status, last_error_message, next_poll_at')
      .eq('user_id', user.id)
      .eq('enabled', true)
      .eq('is_deleted', false);

    if (monitorsError) throw monitorsError;

    if (!monitoredGroups || monitoredGroups.length === 0) {
      return NextResponse.json({
        activeCount: 0,
        limit: SYNCO_METRICS_LIMIT,
        monitoredMembersTotal: 0,
        growth24h: 0,
        estimatedJoined24h: 0,
        estimatedLeft24h: 0,
        lastUpdatedAt: null,
        monitoredGroups: []
      });
    }

    const activeGroupIds = monitoredGroups.map(m => m.group_id);

    // 2. Buscar nomes dos grupos da tabela core "groups"
    const { data: coreGroups, error: coreGroupsError } = await supabase
      .from('groups')
      .select('id, name')
      .eq('user_id', user.id)
      .in('id', activeGroupIds);
      
    if (coreGroupsError) throw coreGroupsError;
    const groupNames = coreGroups?.reduce((acc: any, g: any) => {
      acc[g.id] = g.name || 'Grupo sem nome';
      return acc;
    }, {}) || {};

    // 3. Buscar snapshots desses grupos
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('sm_group_snapshots')
      .select('id, group_id, member_count, captured_at')
      .eq('user_id', user.id)
      .in('group_id', activeGroupIds)
      .order('captured_at', { ascending: false });

    if (snapshotsError) throw snapshotsError;

    // Reduzir pegando apenas o mais recente por group_id
    const latestByGroup: Record<string, any> = {};
    if (snapshots) {
      for (const snap of snapshots) {
        if (!latestByGroup[snap.group_id]) {
          latestByGroup[snap.group_id] = snap;
        }
      }
    }

    // 4. Buscar deltas das últimas 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: deltas, error: deltasError } = await supabase
      .from('sm_group_deltas')
      .select('group_id, delta, estimated_joined, estimated_left')
      .eq('user_id', user.id)
      .in('group_id', activeGroupIds)
      .gte('captured_at', twentyFourHoursAgo);

    if (deltasError) throw deltasError;

    // Agrupar deltas por group_id
    const deltasByGroup: Record<string, any> = {};
    activeGroupIds.forEach(id => {
      deltasByGroup[id] = { growth24h: 0, joined24h: 0, left24h: 0, count: 0 };
    });

    if (deltas) {
      for (const d of deltas) {
        if (deltasByGroup[d.group_id]) {
          deltasByGroup[d.group_id].growth24h += (d.delta || 0);
          deltasByGroup[d.group_id].joined24h += (d.estimated_joined || 0);
          deltasByGroup[d.group_id].left24h += (d.estimated_left || 0);
          deltasByGroup[d.group_id].count++;
        }
      }
    }

    // 5. Montar payload
    let monitoredMembersTotal = 0;
    let totalGrowth24h = 0;
    let totalJoined24h = 0;
    let totalLeft24h = 0;
    let lastUpdatedAt: string | null = null;

    const monitoredGroupsPayload = monitoredGroups.map(monitor => {
      const snap = latestByGroup[monitor.group_id];
      const deltaGroup = deltasByGroup[monitor.group_id];
      
      const memberCount = snap ? snap.member_count : 0;
      monitoredMembersTotal += memberCount;

      totalGrowth24h += deltaGroup.growth24h;
      totalJoined24h += deltaGroup.joined24h;
      totalLeft24h += deltaGroup.left24h;

      // Pegar o lastUpdatedAt baseado no snapshot mais recente globalmente
      if (snap && (!lastUpdatedAt || new Date(snap.captured_at) > new Date(lastUpdatedAt))) {
        lastUpdatedAt = snap.captured_at;
      }

      return {
        monitorId: monitor.id,
        groupId: monitor.group_id,
        groupName: groupNames[monitor.group_id] || 'Desconhecido',
        enabled: monitor.enabled,
        memberCount: memberCount,
        lastSnapshotAt: snap ? snap.captured_at : null,
        hasSnapshot: !!snap,
        hasDeltas: deltaGroup.count > 0,
        growth24h: deltaGroup.growth24h,
        joined24h: deltaGroup.joined24h,
        left24h: deltaGroup.left24h,
        lastPollStatus: monitor.last_poll_status,
        lastErrorMessage: monitor.last_error_message,
        nextPollAt: monitor.next_poll_at
      };
    });

    return NextResponse.json({
      activeCount: monitoredGroups.length,
      limit: SYNCO_METRICS_LIMIT,
      monitoredMembersTotal,
      growth24h: totalGrowth24h,
      estimatedJoined24h: totalJoined24h,
      estimatedLeft24h: totalLeft24h,
      lastUpdatedAt,
      monitoredGroups: monitoredGroupsPayload
    });

  } catch (error: any) {
    console.error('[SYNCOMETRICS-SUMMARY]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
