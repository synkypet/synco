import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const VALID_PERIODS = ['today', 'last_7d', 'last_30d'];

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'last_7d';
    
    if (!VALID_PERIODS.includes(period)) {
      return NextResponse.json({ error: 'Período inválido' }, { status: 400 });
    }

    // 1. Fetch monitor and core group
    const { data: monitor, error: monitorError } = await supabase
      .from('sm_metric_monitors')
      .select(`
        id,
        group_id,
        campaign_id,
        campaign_name,
        monitor_name,
        ad_account_id,
        baseline_at,
        baseline_member_count,
        baseline_snapshot_id,
        groups ( name )
      `)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (monitorError || !monitor) {
      return NextResponse.json({ error: 'Monitoramento não encontrado' }, { status: 404 });
    }

    const payload: any = {
      monitor: {
        id: monitor.id,
        name: monitor.monitor_name || `${monitor.campaign_name} → ${(monitor.groups as any)?.name || 'Grupo'}`,
        campaignName: monitor.campaign_name,
        groupName: (monitor.groups as any)?.name || 'Grupo sem nome',
        baselineAt: monitor.baseline_at,
        baselineMemberCount: monitor.baseline_member_count,
        baselineSnapshotId: monitor.baseline_snapshot_id
      },
      meta: {
        spend: 0,
        leads: 0,
        clicks: 0,
        impressions: 0,
        ctr: null,
        cpc: null,
        cpm: null,
        costPerLead: null,
        error: null
      },
      group: {
        currentMembers: 0,
        estimatedJoined: 0,
        estimatedLeft: 0,
        netGrowth: 0,
        effectiveStart: monitor.baseline_at
      },
      comparison: {
        realCostPerMember: null,
        difference: 0,
        leadToMemberRate: 0
      },
      timeline: []
    };

    // 2. Fetch Meta Ads Data
    const { data: connection } = await supabase
      .from('sm_meta_connections')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (connection) {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceRoleKey) {
        const supabaseService = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey);
        const { data: secret } = await supabaseService
          .from('sm_meta_secrets')
          .select('access_token')
          .eq('connection_id', connection.id)
          .single();

        if (secret && secret.access_token) {
          try {
            const datePreset = period === 'today' ? 'today' : period === 'last_30d' ? 'last_30d' : 'last_7d';
            const fields = 'campaign_id,spend,impressions,clicks,actions,cost_per_action_type';
            const metaUrl = `https://graph.facebook.com/v19.0/${connection.ad_account_id}/insights?level=campaign&date_preset=${datePreset}&fields=${fields}&action_breakdowns=action_type&access_token=${secret.access_token}`;
            
            const metaRes = await fetch(metaUrl);
            const metaData = await metaRes.json();

            if (!metaData.error && metaData.data) {
              const campaignRow = metaData.data.find((row: any) => row.campaign_id === monitor.campaign_id);
              if (campaignRow) {
                payload.meta.spend = parseFloat(campaignRow.spend || 0);
                payload.meta.impressions = parseInt(campaignRow.impressions || 0, 10);
                payload.meta.clicks = parseInt(campaignRow.clicks || 0, 10);

                let finalLeads = 0;
                payload.meta.events = [];

                if (campaignRow.actions) {
                  let onfbLead = 0;
                  let onsiteLead = 0;
                  const detected: Record<string, number> = {};
                  const eventCosts: Record<string, number> = {};

                  if (campaignRow.cost_per_action_type) {
                    campaignRow.cost_per_action_type.forEach((c: any) => {
                      eventCosts[c.action_type] = parseFloat(c.value || 0);
                    });
                  }
                  
                  campaignRow.actions.forEach((act: any) => {
                    const type = act.action_type;
                    const val = parseInt(act.value || 0, 10);
                    detected[type] = (detected[type] || 0) + val;
                  });

                  if (detected['lead']) onfbLead = detected['lead'];
                  if (detected['onsite_web_lead']) onsiteLead = detected['onsite_web_lead'];

                  if (onfbLead > 0) finalLeads = onfbLead;
                  else if (onsiteLead > 0) finalLeads = onsiteLead;
                  else {
                    const keys = Object.keys(detected);
                    if (keys.length > 0) {
                      finalLeads = keys.reduce((acc, k) => acc + detected[k], 0);
                    }
                  }

                  payload.meta.events = Object.entries(detected).map(([type, val]) => {
                    let isLeadCandidate = false;
                    if (onfbLead > 0) {
                      if (type === 'lead') isLeadCandidate = true;
                    } else if (onsiteLead > 0) {
                      if (type === 'onsite_web_lead') isLeadCandidate = true;
                    } else {
                      isLeadCandidate = true; // Se somou tudo, tudo é candidato
                    }

                    return {
                      actionType: type,
                      value: val,
                      cost: eventCosts[type] || null,
                      isLeadCandidate
                    };
                  });
                }
                payload.meta.leads = finalLeads;

                if (payload.meta.clicks > 0 && payload.meta.impressions > 0) {
                  payload.meta.ctr = parseFloat(((payload.meta.clicks / payload.meta.impressions) * 100).toFixed(2));
                }
                if (payload.meta.clicks > 0) {
                  payload.meta.cpc = parseFloat((payload.meta.spend / payload.meta.clicks).toFixed(2));
                }
                if (payload.meta.impressions > 0) {
                  payload.meta.cpm = parseFloat(((payload.meta.spend / payload.meta.impressions) * 1000).toFixed(2));
                }
                if (payload.meta.leads > 0) {
                  payload.meta.costPerLead = parseFloat((payload.meta.spend / payload.meta.leads).toFixed(2));
                }
              }
            } else if (metaData.error) {
              const safeError = { ...metaData.error };
              if (safeError.message && typeof safeError.message === 'string') {
                safeError.message = safeError.message.replace(/access_token=[^&]+/g, 'access_token=[REDACTED_TOKEN]');
              }
              console.error('[Meta Details] Error', {
                code: safeError.code,
                message: safeError.message,
                status: safeError.error_subcode || safeError.status,
                userId: user.id
              });

              if (metaData.error.code === 190) {
                payload.meta.error = 'META_TOKEN_EXPIRED';
                payload.meta.errorMessage = 'Sua conexão Meta expirou. Reconecte em Configurações → SyncoMetrics.';
              } else if (metaData.error.code === 10 || metaData.error.code === 200) {
                payload.meta.error = 'META_PERMISSION_DENIED';
                payload.meta.errorMessage = 'A conexão Meta não tem permissão para ler campanhas. Reconecte usando a permissão ads_read.';
              } else {
                payload.meta.error = 'META_API_ERROR';
                payload.meta.errorMessage = 'Não foi possível consultar a Meta no momento. Tente novamente em instantes.';
              }
            }
          } catch (e: any) {
            console.error('[Meta Details] Fetch failed', e.message);
            payload.meta.error = 'META_FETCH_ERROR';
            payload.meta.errorMessage = 'Erro ao conectar com a Meta.';
          }
        }
      }
    }

    // 3. Fetch Group Snapshot Data
    const { data: latestSnapshot } = await supabase
      .from('sm_group_snapshots')
      .select('member_count')
      .eq('group_id', monitor.group_id)
      .order('captured_at', { ascending: false })
      .limit(1)
      .single();

    payload.group.currentMembers = latestSnapshot ? latestSnapshot.member_count : 0;

    // 4. Fetch Deltas
    let startDate = new Date();
    startDate.setUTCHours(3, 0, 0, 0); // ~meia noite BRT
    if (period === 'last_7d') startDate.setDate(startDate.getDate() - 7);
    if (period === 'last_30d') startDate.setDate(startDate.getDate() - 30);
    const startDateStr = startDate.toISOString();

    const { data: deltas } = await supabase
      .from('sm_group_deltas')
      .select(`
        id,
        previous_count,
        current_count,
        delta,
        estimated_joined,
        estimated_left,
        captured_at,
        previous_snapshot:previous_snapshot_id(captured_at)
      `)
      .eq('group_id', monitor.group_id)
      .gte('captured_at', startDateStr)
      .order('captured_at', { ascending: false });

    if (deltas) {
      deltas.forEach(d => {
        let prevCapturedAt = null;
        if (d.previous_snapshot) {
          prevCapturedAt = Array.isArray(d.previous_snapshot) ? d.previous_snapshot[0]?.captured_at : (d.previous_snapshot as any).captured_at;
        }

        if (!prevCapturedAt) return; // Se não tem prev, não temos como validar baseline conservador.
        if (monitor.baseline_at && new Date(prevCapturedAt) < new Date(monitor.baseline_at)) return; // Regra conservadora

        // Se passar pelo filtro, soma os contadores
        payload.group.estimatedJoined += (d.estimated_joined || 0);
        payload.group.estimatedLeft += (d.estimated_left || 0);
        payload.group.netGrowth += (d.delta || 0);

        // Somente adicionar à timeline se tiver delta ou joining
        if ((d.delta !== 0) || (d.estimated_joined > 0) || (d.estimated_left > 0)) {
          payload.timeline.push({
            from: prevCapturedAt,
            to: d.captured_at,
            previousCount: d.previous_count,
            currentCount: d.current_count,
            estimatedJoined: d.estimated_joined,
            estimatedLeft: d.estimated_left,
            delta: d.delta
          });
        }
      });
    }

    // 5. Build Comparison
    payload.comparison.difference = payload.group.estimatedJoined - payload.meta.leads;
    if (payload.group.estimatedJoined > 0) {
      payload.comparison.realCostPerMember = parseFloat((payload.meta.spend / payload.group.estimatedJoined).toFixed(2));
    }
    if (payload.meta.leads > 0) {
      payload.comparison.leadToMemberRate = parseFloat(((payload.group.estimatedJoined / payload.meta.leads) * 100).toFixed(2));
    }

    return NextResponse.json(payload);
  } catch (error: any) {
    console.error(`[GET /monitors/${params.id}/details]`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
