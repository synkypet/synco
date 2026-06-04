import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import moment from 'moment';

const VALID_PERIODS = ['today', 'last_7d', 'last_30d'];

export const dynamic = 'force-dynamic';

function formatCurrency(val: number | null) {
  if (val === null || isNaN(val)) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatNumber(val: number | null) {
  if (val === null || isNaN(val)) return '0';
  return val.toString();
}

function formatDate(isoStr: string) {
  if (!isoStr) return '';
  return moment(isoStr).format('DD/MM/YYYY HH:mm');
}

function escapeCsv(val: string | number | null) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(';') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'last_7d';
    const format = searchParams.get('format');
    
    if (format !== 'csv') {
      return NextResponse.json({ error: 'Formato ainda não suportado.' }, { status: 400 });
    }

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
        error: null,
        events: []
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
              payload.meta.error = metaData.error.code === 190 ? 'Token expirado' : 'Erro Meta API';
            }
          } catch (e) {
            console.error('Meta API falhou', e);
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

    // 6. Build CSV
    const lines: string[] = [];
    const addRow = (row: string[]) => lines.push(row.map(escapeCsv).join(';'));

    // --- Seção 1: Resumo ---
    addRow(['Seção', 'Campo', 'Valor']);
    addRow(['Resumo', 'Nome do monitoramento', payload.monitor.name]);
    addRow(['Resumo', 'Campanha', payload.monitor.campaignName]);
    addRow(['Resumo', 'Grupo', payload.monitor.groupName]);
    addRow(['Resumo', 'Período', period === 'today' ? 'Hoje' : period === 'last_7d' ? 'Últimos 7 dias' : 'Últimos 30 dias']);
    addRow(['Resumo', 'Início do monitoramento', formatDate(payload.monitor.baselineAt)]);
    addRow(['Resumo', 'Membros no início', formatNumber(payload.monitor.baselineMemberCount)]);
    addRow(['Resumo', 'Membros atuais', formatNumber(payload.group.currentMembers)]);
    addRow(['Resumo', 'Gasto Meta', formatCurrency(payload.meta.spend)]);
    addRow(['Resumo', 'Leads informados', formatNumber(payload.meta.leads)]);
    addRow(['Resumo', 'Cliques', formatNumber(payload.meta.clicks)]);
    addRow(['Resumo', 'Impressões', formatNumber(payload.meta.impressions)]);
    addRow(['Resumo', 'CTR', payload.meta.ctr !== null ? `${payload.meta.ctr}%` : '0%']);
    addRow(['Resumo', 'CPC', formatCurrency(payload.meta.cpc)]);
    addRow(['Resumo', 'CPM', formatCurrency(payload.meta.cpm)]);
    addRow(['Resumo', 'Custo por Lead', formatCurrency(payload.meta.costPerLead)]);
    addRow(['Resumo', 'Crescimento líquido (Estimado)', `+${formatNumber(payload.group.estimatedJoined)}`]);
    addRow(['Resumo', 'Saldo do período', formatNumber(payload.group.netGrowth)]);
    addRow(['Resumo', 'Custo por membro líquido', formatCurrency(payload.comparison.realCostPerMember)]);
    addRow(['Resumo', 'Diferença Meta x Saldo', formatNumber(payload.comparison.difference)]);
    addRow(['Resumo', 'Taxa Lead -> Membro líquido', payload.comparison.leadToMemberRate !== null ? `${payload.comparison.leadToMemberRate}%` : '0%']);
    
    lines.push(''); // Linha em branco

    // --- Seção 2: Linha do Tempo ---
    addRow(['Seção', 'Início', 'Fim', 'Membros antes', 'Membros depois', 'Saldo líquido', 'Entradas líquidas estimadas', 'Saídas líquidas estimadas']);
    payload.timeline.forEach((t: any) => {
      addRow([
        'Linha do Tempo',
        formatDate(t.from),
        formatDate(t.to),
        formatNumber(t.previousCount),
        formatNumber(t.currentCount),
        (t.delta > 0 ? '+' : '') + formatNumber(t.delta),
        `+${formatNumber(t.estimatedJoined)}`,
        `-${formatNumber(t.estimatedLeft)}`
      ]);
    });

    lines.push(''); // Linha em branco

    // --- Seção 3: Eventos Meta / Pixel ---
    addRow(['Seção', 'Evento', 'Quantidade', 'Custo por evento', 'Candidato a Lead']);
    if (payload.meta.events && payload.meta.events.length > 0) {
      payload.meta.events.forEach((ev: any) => {
        addRow([
          'Eventos Meta',
          ev.actionType,
          formatNumber(ev.value),
          formatCurrency(ev.cost),
          ev.isLeadCandidate ? 'Sim' : 'Não'
        ]);
      });
    } else {
      addRow(['Eventos Meta', 'Nenhum evento retornado', '', '', '']);
    }

    lines.push(''); // Linha em branco

    // --- Seção 4: Observações ---
    addRow(['Observações', 'Texto']);
    addRow(['Observações', 'As métricas da Meta são consultadas diretamente da Meta Ads para o período selecionado.']);
    addRow(['Observações', 'As métricas do grupo são calculadas pela variação líquida da contagem de membros entre coletas.']);
    addRow(['Observações', 'Entradas e saídas simultâneas no mesmo intervalo podem se anular no saldo líquido.']);

    // Generate CSV Buffer
    const bom = '\uFEFF';
    const csvContent = bom + lines.join('\n');

    // Sanitizar filename
    const safeName = (payload.monitor.name || 'export').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `syncometrics-${safeName}-${period}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });

  } catch (error: any) {
    console.error(`[GET /monitors/${params.id}/export]`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
