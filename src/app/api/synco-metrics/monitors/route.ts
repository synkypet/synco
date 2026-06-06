import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { fetchMetaWithCacheAndLimit } from '@/lib/meta-api';

const VALID_PERIODS = ['today', 'last_7d', 'last_30d'];

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    // 1. Buscar monitores ativos
    const { data: monitors, error: monitorsError } = await supabase
      .from('sm_metric_monitors')
      .select(`
        id,
        group_id,
        campaign_id,
        campaign_name,
        monitor_name,
        monitor_type,
        ad_account_id,
        baseline_at,
        groups ( name )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (monitorsError) throw monitorsError;

    if (!monitors || monitors.length === 0) {
      return NextResponse.json({ monitors: [] });
    }

    // Preparar as métricas default
    const resultMonitors = monitors.map((m: any) => ({
      id: m.id,
      groupId: m.group_id,
      groupName: m.groups?.name || 'Grupo sem nome',
      campaignId: m.campaign_id,
      campaignName: m.campaign_name,
      monitorType: m.monitor_type || 'meta_campaign',
      monitorName: m.monitor_name || (m.monitor_type === 'group_only' ? (m.groups?.name || 'Grupo') : `${m.campaign_name} → ${m.groups?.name || 'Grupo'}`),
      baselineAt: m.baseline_at,
      meta: m.monitor_type === 'group_only' ? null : { spend: 0, leads: 0, clicks: 0, impressions: 0, cpc: null as number | null, ctr: null as number | null, cpm: null as number | null, costPerLead: null as number | null, error: null as string | null },
      group: { currentMembers: 0, estimatedJoined: 0, estimatedLeft: 0, netGrowth: 0 },
      comparison: m.monitor_type === 'group_only' ? null : { realCostPerMember: null as number | null, difference: 0, leadToMemberRate: null as number | null }
    }));

    // 2. Conexão Meta e Insights em lote (level=campaign)
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
            const fields = 'campaign_id,spend,impressions,clicks,actions';
            // level=campaign permite trazer dados de todas as campanhas da conta em 1 request
            const metaUrl = `https://graph.facebook.com/v19.0/${connection.ad_account_id}/insights?level=campaign&date_preset=${datePreset}&fields=${fields}&action_breakdowns=action_type`;
            
            let metaData;
            try {
              metaData = await fetchMetaWithCacheAndLimit(metaUrl, secret.access_token, user.id);
            } catch (err: any) {
               if (err.message === 'META_RATE_LIMIT_EXCEEDED') {
                 resultMonitors.forEach(m => {
                   if (m.meta) m.meta.error = 'META_RATE_LIMIT_EXCEEDED';
                 });
                 return NextResponse.json({ monitors: resultMonitors });
               }
               throw err;
            }

            if (!metaData.error && metaData.data) {
              const metaByCampaign: Record<string, any> = {};

              metaData.data.forEach((row: any) => {
                const cid = row.campaign_id;
                if (!metaByCampaign[cid]) {
                  metaByCampaign[cid] = { spend: 0, impressions: 0, clicks: 0, leads: 0 };
                }

                metaByCampaign[cid].spend += parseFloat(row.spend || 0);
                metaByCampaign[cid].impressions += parseInt(row.impressions || 0, 10);
                metaByCampaign[cid].clicks += parseInt(row.clicks || 0, 10);

                let finalLeads = 0;
                if (row.actions) {
                  let onfbLead = 0;
                  let onsiteLead = 0;
                  const detected: any = {};
                  
                  row.actions.forEach((act: any) => {
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
                }
                metaByCampaign[cid].leads += finalLeads;
              });

              // Preencher resultado
              resultMonitors.forEach(m => {
                if (m.monitorType === 'group_only' || !m.meta) return;

                const metaRow = metaByCampaign[m.campaignId];
                if (metaRow) {
                  m.meta.spend = parseFloat(metaRow.spend.toFixed(2));
                  m.meta.impressions = metaRow.impressions;
                  m.meta.clicks = metaRow.clicks;
                  m.meta.leads = metaRow.leads;
                  
                  if (m.meta.clicks > 0 && m.meta.impressions > 0) {
                    m.meta.ctr = parseFloat(((m.meta.clicks / m.meta.impressions) * 100).toFixed(2));
                  }
                  if (m.meta.clicks > 0) {
                    m.meta.cpc = parseFloat((m.meta.spend / m.meta.clicks).toFixed(2));
                  }
                  if (m.meta.impressions > 0) {
                    m.meta.cpm = parseFloat(((m.meta.spend / m.meta.impressions) * 1000).toFixed(2));
                  }
                  if (m.meta.leads > 0) {
                    m.meta.costPerLead = parseFloat((m.meta.spend / m.meta.leads).toFixed(2));
                  }
                }
              });
            } else if (metaData.error) {
              const safeError = { ...metaData.error };
              if (safeError.message && typeof safeError.message === 'string') {
                safeError.message = safeError.message.replace(secret.access_token, '[REDACTED_TOKEN]');
              }
              console.error('[Meta Monitors] Error', {
                code: safeError.code,
                message: safeError.message,
                status: safeError.error_subcode || safeError.status,
                userId: user.id
              });

               resultMonitors.forEach(m => {
                 if (m.monitorType === 'group_only' || !m.meta) return;

                 if (metaData.error.code === 190) {
                   m.meta.error = 'META_TOKEN_EXPIRED';
                 } else if (metaData.error.code === 10 || metaData.error.code === 200) {
                   m.meta.error = 'META_PERMISSION_DENIED';
                 } else {
                   m.meta.error = 'META_API_ERROR';
                 }
               });
            }
          } catch (e: any) {
            console.error('[Meta Monitors] Fetch failed', e.message);
          }
        }
      }
    }

    // 3. Buscar dados de Grupo (Deltas e Snapshots)
    const groupIds = Array.from(new Set(monitors.map(m => m.group_id)));

    // Current members
    const { data: snapshots } = await supabase
      .from('sm_group_snapshots')
      .select('group_id, member_count')
      .in('group_id', groupIds)
      .order('captured_at', { ascending: false });

    const currentByGroup: Record<string, number> = {};
    if (snapshots) {
      for (const snap of snapshots) {
        if (currentByGroup[snap.group_id] === undefined) {
          currentByGroup[snap.group_id] = snap.member_count;
        }
      }
    }

    // Date range para deltas
    let startDate = new Date();
    startDate.setUTCHours(3, 0, 0, 0); // ~meia noite BRT
    if (period === 'last_7d') startDate.setDate(startDate.getDate() - 7);
    if (period === 'last_30d') startDate.setDate(startDate.getDate() - 30);
    const startDateStr = startDate.toISOString();

    const { data: deltas } = await supabase
      .from('sm_group_deltas')
      .select('group_id, delta, estimated_joined, estimated_left, previous_snapshot:previous_snapshot_id(captured_at)')
      .in('group_id', groupIds)
      .gte('captured_at', startDateStr);

    // Preencher resultado do grupo e comparar
    resultMonitors.forEach(m => {
      const gId = m.groupId;
      m.group.currentMembers = currentByGroup[gId] || 0;
      
      let joined = 0;
      let left = 0;
      let netDelta = 0;

      if (deltas) {
        const monitorDeltas = deltas.filter(d => {
          if (d.group_id !== gId) return false;
          
          // Tratamento para extrair captured_at (Supabase pode retornar array ou objeto dependendo de como 1:1 é interpretado)
          let prevCapturedAt = null;
          if (d.previous_snapshot) {
             prevCapturedAt = Array.isArray(d.previous_snapshot) ? d.previous_snapshot[0]?.captured_at : (d.previous_snapshot as any).captured_at;
          }
          if (!prevCapturedAt) return false;

          // Regra conservadora: previous_snapshot.captured_at >= baseline_at
          if (m.baselineAt && new Date(prevCapturedAt) < new Date(m.baselineAt)) {
            return false;
          }
          return true;
        });

        monitorDeltas.forEach(d => {
          joined += (d.estimated_joined || 0);
          left += (d.estimated_left || 0);
          netDelta += (d.delta || 0);
        });
      }

      m.group.estimatedJoined = joined;
      m.group.estimatedLeft = left;
      m.group.netGrowth = netDelta;

      // Comparison
      if (m.monitorType !== 'group_only' && m.comparison && m.meta) {
        const realEntries = m.group.estimatedJoined;
        m.comparison.difference = realEntries - m.meta.leads;
        
        if (realEntries > 0) {
          m.comparison.realCostPerMember = parseFloat((m.meta.spend / realEntries).toFixed(2));
        }
        
        if (m.meta.leads > 0) {
          m.comparison.leadToMemberRate = parseFloat(((realEntries / m.meta.leads) * 100).toFixed(2));
        }
      }
    });

    return NextResponse.json({ monitors: resultMonitors });
  } catch (error: any) {
    console.error('[GET /monitors]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const payload = await request.json();
    const { monitorType = 'meta_campaign', groupId, campaignId, campaignName, monitorName } = payload;

    if (!groupId) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios ausentes (groupId)' }, { status: 400 });
    }

    if (monitorType === 'meta_campaign' && (!campaignId || !campaignName)) {
      return NextResponse.json({ error: 'Parâmetros de campanha obrigatórios ausentes para Meta Ads' }, { status: 400 });
    }

    // 1. Validar grupo em sm_monitored_groups
    const { data: mg } = await supabase
      .from('sm_monitored_groups')
      .select('id')
      .eq('user_id', user.id)
      .eq('group_id', groupId)
      .eq('enabled', true)
      .eq('is_deleted', false)
      .single();

    if (!mg) {
      return NextResponse.json({ error: 'Grupo inválido ou não monitorado pelo SyncoMetrics' }, { status: 400 });
    }

    // 1.5 Verificar se já existe monitoramento para o mesmo grupo e campanha/tipo
    let query = supabase
      .from('sm_metric_monitors')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('group_id', groupId)
      .eq('monitor_type', monitorType);

    if (monitorType === 'meta_campaign') {
      query = query.eq('campaign_id', campaignId);
    }

    const { data: existing } = await query.maybeSingle();

    if (existing) {
      if (existing.status === 'deleted') {
        await supabase
          .from('sm_metric_monitors')
          .delete()
          .eq('id', existing.id);
      } else {
        return NextResponse.json({ error: 'Este monitoramento já está ativo.' }, { status: 409 });
      }
    }

    // 2. Buscar último snapshot para preencher baseline
    const { data: latestSnapshot } = await supabase
      .from('sm_group_snapshots')
      .select('id, member_count')
      .eq('user_id', user.id)
      .eq('group_id', groupId)
      .order('captured_at', { ascending: false })
      .limit(1)
      .single();

    // 3. Buscar ad_account_id se for meta_campaign
    let adAccountId = null;
    if (monitorType === 'meta_campaign') {
      const { data: connection } = await supabase
        .from('sm_meta_connections')
        .select('ad_account_id')
        .eq('user_id', user.id)
        .single();

      if (!connection || !connection.ad_account_id) {
        return NextResponse.json({ error: 'Conta Meta não conectada' }, { status: 400 });
      }
      adAccountId = connection.ad_account_id;
    }

    // 4. Inserir monitor com baseline
    const { error: insertError } = await supabase
      .from('sm_metric_monitors')
      .insert({
        user_id: user.id,
        group_id: groupId,
        monitor_type: monitorType,
        campaign_id: monitorType === 'meta_campaign' ? campaignId : null,
        campaign_name: monitorType === 'meta_campaign' ? campaignName : null,
        ad_account_id: adAccountId,
        monitor_name: monitorName || null,
        baseline_at: new Date().toISOString(),
        baseline_snapshot_id: latestSnapshot ? latestSnapshot.id : null,
        baseline_member_count: latestSnapshot ? latestSnapshot.member_count : null
      });

    if (insertError) {
      if (insertError.code === '23505') { // unique violation
        return NextResponse.json({ error: 'Este monitoramento já existe' }, { status: 409 });
      }
      throw insertError;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[POST /monitors]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
