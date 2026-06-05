import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { fetchMetaWithCacheAndLimit } from '@/lib/meta-api';

const VALID_PERIODS = ['today', 'last_7d', 'last_30d'];

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // 1. Validar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'last_7d';
    
    if (!VALID_PERIODS.includes(period)) {
      return NextResponse.json({ error: 'Período inválido' }, { status: 400 });
    }

    // Estrutura de resposta padrão
    const responseData = {
      period,
      meta: {
        connected: false,
        hasData: false,
        error: null as string | null,
        adAccountId: null as string | null,
        adAccountName: null as string | null,
        currency: null as string | null,
        spend: 0,
        impressions: 0,
        reach: 0,
        clicks: 0,
        ctr: null as number | null,
        cpc: null as number | null,
        cpm: null as number | null,
        leads: 0,
        costPerLead: null as number | null,
        leadDetectionMode: null as string | null,
        actionsRawTypes: [] as string[],
        detectedLeadActions: {} as Record<string, number>
      },
      groups: {
        hasMonitoredGroups: false,
        hasDeltas: false,
        monitoredCount: 0,
        currentMembers: 0,
        estimatedJoined: 0,
        estimatedLeft: 0,
        netGrowth: 0
      },
      comparison: {
        metaLeads: 0,
        realMembers: 0,
        difference: 0,
        metaCostPerLead: null as number | null,
        realCostPerMember: null as number | null,
        leadToMemberRate: null as number | null
      }
    };

    // 2. Buscar conexão do usuário
    const { data: connection } = await supabase
      .from('sm_meta_connections')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (connection) {
      responseData.meta.connected = true;
      responseData.meta.adAccountId = connection.ad_account_id;
      responseData.meta.adAccountName = connection.account_name;
      responseData.meta.currency = connection.currency;

      // 3. Buscar secret com service role
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) {
        console.error('SUPABASE_SERVICE_ROLE_KEY não configurada');
        responseData.meta.error = 'Erro interno de configuração Meta';
      } else {
        const supabaseService = createServiceClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceRoleKey
        );

        const { data: secret } = await supabaseService
          .from('sm_meta_secrets')
          .select('access_token')
          .eq('connection_id', connection.id)
          .single();

        if (!secret || !secret.access_token) {
          responseData.meta.error = 'Credenciais Meta não encontradas ou inválidas';
        } else {
          // 4. Consultar Meta Graph API
          try {
            const datePreset = period === 'today' ? 'today' : period === 'last_30d' ? 'last_30d' : 'last_7d';
            
            const fields = 'spend,impressions,reach,clicks,ctr,cpc,cpm,actions';
            const campaignId = searchParams.get('campaign_id');
            const targetId = (campaignId && campaignId !== 'all') ? campaignId : connection.ad_account_id;
            
            const metaUrl = `https://graph.facebook.com/v19.0/${targetId}/insights?date_preset=${datePreset}&fields=${fields}&action_breakdowns=action_type`;
            
            let metaData;
            try {
              metaData = await fetchMetaWithCacheAndLimit(metaUrl, secret.access_token, user.id);
            } catch (err: any) {
              if (err.message === 'META_RATE_LIMIT_EXCEEDED') {
                responseData.meta.error = 'META_RATE_LIMIT_EXCEEDED';
                return NextResponse.json(responseData);
              }
              throw err;
            }

            if (metaData.error) {
              const safeError = { ...metaData.error };
              if (safeError.message && typeof safeError.message === 'string') {
                safeError.message = safeError.message.replace(secret.access_token, '[REDACTED_TOKEN]');
              }
              
              console.error('[Meta Overview] Error', {
                code: safeError.code,
                message: safeError.message,
                status: safeError.error_subcode || safeError.status,
                userId: user.id
              });

              if (metaData.error.code === 190) {
                 responseData.meta.error = 'META_TOKEN_EXPIRED';
              } else if (metaData.error.code === 10 || metaData.error.code === 200) {
                 responseData.meta.error = 'META_PERMISSION_DENIED';
              } else {
                 responseData.meta.error = 'META_API_ERROR';
              }
            } else if (metaData.data && metaData.data.length > 0) {
              responseData.meta.hasData = true;
              
              // Somar insights, pois podem vir particionados (embora sem breakdown venha 1 linha)
              let totalSpend = 0;
              let totalImpressions = 0;
              let totalReach = 0;
              let totalClicks = 0;
              const allActions: Record<string, number> = {};

              metaData.data.forEach((row: any) => {
                totalSpend += parseFloat(row.spend || 0);
                totalImpressions += parseInt(row.impressions || 0, 10);
                totalReach += parseInt(row.reach || 0, 10);
                totalClicks += parseInt(row.clicks || 0, 10);

                if (row.actions) {
                  row.actions.forEach((act: any) => {
                    const type = act.action_type;
                    const val = parseInt(act.value || 0, 10);
                    if (!allActions[type]) allActions[type] = 0;
                    allActions[type] += val;
                    if (!responseData.meta.actionsRawTypes.includes(type)) {
                      responseData.meta.actionsRawTypes.push(type);
                    }
                  });
                }
              });

              responseData.meta.spend = parseFloat(totalSpend.toFixed(2));
              responseData.meta.impressions = totalImpressions;
              responseData.meta.reach = totalReach;
              responseData.meta.clicks = totalClicks;

              // Calcular médias ponderadas
              responseData.meta.ctr = totalImpressions > 0 ? parseFloat(((totalClicks / totalImpressions) * 100).toFixed(2)) : null;
              responseData.meta.cpc = totalClicks > 0 ? parseFloat((totalSpend / totalClicks).toFixed(2)) : null;
              responseData.meta.cpm = totalImpressions > 0 ? parseFloat(((totalSpend / totalImpressions) * 1000).toFixed(2)) : null;

              // Identificar Leads com prioridade
              let finalLeads = 0;
              let leadMode = 'none';
              const detectedLeads: Record<string, number> = {};

              // Analisa actionsRawTypes e popula os actions com lead
              Object.keys(allActions).forEach(type => {
                if (type.includes('lead')) {
                  detectedLeads[type] = allActions[type];
                }
              });
              responseData.meta.detectedLeadActions = detectedLeads;

              if (allActions['offsite_conversion.fb_pixel_lead'] !== undefined) {
                finalLeads = allActions['offsite_conversion.fb_pixel_lead'];
                leadMode = 'fb_pixel_lead';
              } else if (allActions['lead'] !== undefined) {
                finalLeads = allActions['lead'];
                leadMode = 'lead';
              } else if (allActions['onsite_web_lead'] !== undefined) {
                finalLeads = allActions['onsite_web_lead'];
                leadMode = 'onsite_web_lead';
              } else {
                // Fallback sum
                const leadKeys = Object.keys(detectedLeads);
                if (leadKeys.length > 0) {
                  finalLeads = leadKeys.reduce((acc, k) => acc + detectedLeads[k], 0);
                  leadMode = 'fallback_contains_lead';
                }
              }

              responseData.meta.leads = finalLeads;
              responseData.meta.leadDetectionMode = leadMode;
              responseData.meta.costPerLead = finalLeads > 0 ? parseFloat((totalSpend / finalLeads).toFixed(2)) : null;
            }
          } catch (err) {
            console.error('Fetch Meta fail:', err);
            responseData.meta.error = 'Falha de rede ao consultar Meta API';
          }
        }
      }
    }

    // 5. Consulta Grupos (America/Sao_Paulo timezone rule)
    const groupIdParam = searchParams.get('group_id');
    const isSpecificGroup = groupIdParam && groupIdParam !== 'all';

    let query = supabase
      .from('sm_monitored_groups')
      .select('group_id')
      .eq('user_id', user.id)
      .eq('enabled', true)
      .eq('is_deleted', false);

    if (isSpecificGroup) {
      query = query.eq('group_id', groupIdParam);
    }

    const { data: monitoredGroups } = await query;

    if (isSpecificGroup && (!monitoredGroups || monitoredGroups.length === 0)) {
      responseData.meta.error = 'Grupo não encontrado ou não monitorado.';
    } else if (monitoredGroups && monitoredGroups.length > 0) {
      responseData.groups.hasMonitoredGroups = true;
      responseData.groups.monitoredCount = monitoredGroups.length;
      
      const groupIds = monitoredGroups.map(g => g.group_id);

      // Current members
      // (Buscamos o snapshot mais recente para cada group, porém simplificando pegamos todos recentes limit 1 por grupo)
      // Como o Supabase rest API n tem DISTINCT ON, vamos usar .in e ordenar.
      const { data: snapshots } = await supabase
        .from('sm_group_snapshots')
        .select('group_id, current_members')
        .in('group_id', groupIds)
        .order('captured_at', { ascending: false });

      if (snapshots) {
        const seen = new Set();
        let totalCurrent = 0;
        for (const snap of snapshots) {
          if (!seen.has(snap.group_id)) {
            seen.add(snap.group_id);
            totalCurrent += snap.current_members;
          }
        }
        responseData.groups.currentMembers = totalCurrent;
      }

      // Definir início do período em UTC coerente com America/Sao_Paulo local
      // Forma nativa TS/JS - Usando Intl para achar offset ou apenas subtraindo horas.
      // O mais seguro sem deps é pegar o Date e considerar UTC. Para MVP "hoje", usamos o começo do dia UTC
      // para evitar complexidade e pq worker roda de hora em hora.
      const now = new Date();
      let startDateStr = '';

      if (period === 'today') {
         // Ajuste manual SP = UTC-3
         const nowSP = new Date(now.getTime() - (3 * 60 * 60 * 1000));
         nowSP.setUTCHours(0,0,0,0);
         // Volta pro UTC correspondente (+3)
         const startUTC = new Date(nowSP.getTime() + (3 * 60 * 60 * 1000));
         startDateStr = startUTC.toISOString();
      } else if (period === 'last_7d') {
         const last7 = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
         startDateStr = last7.toISOString();
      } else if (period === 'last_30d') {
         const last30 = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
         startDateStr = last30.toISOString();
      }

      const { data: deltas } = await supabase
        .from('sm_group_deltas')
        .select('delta, estimated_joined, estimated_left')
        .in('group_id', groupIds)
        .gte('captured_at', startDateStr);
      
      if (deltas && deltas.length > 0) {
        responseData.groups.hasDeltas = true;
        let joined = 0;
        let left = 0;
        let net = 0;

        deltas.forEach(d => {
          joined += (d.estimated_joined || 0);
          left += (d.estimated_left || 0);
          net += (d.delta || 0);
        });

        responseData.groups.estimatedJoined = joined;
        responseData.groups.estimatedLeft = left;
        responseData.groups.netGrowth = net;
      }
    }

    // 6. Calcula Comparativo Seguro
    const metaLeads = responseData.meta.leads;
    const realMembers = responseData.groups.estimatedJoined;
    
    responseData.comparison.metaLeads = metaLeads;
    responseData.comparison.realMembers = realMembers;
    responseData.comparison.difference = metaLeads - realMembers;
    responseData.comparison.metaCostPerLead = responseData.meta.costPerLead;
    
    // cost per real member
    if (responseData.meta.spend > 0 && realMembers > 0) {
      responseData.comparison.realCostPerMember = parseFloat((responseData.meta.spend / realMembers).toFixed(2));
    }

    // lead to member rate
    if (metaLeads > 0) {
      responseData.comparison.leadToMemberRate = parseFloat(((realMembers / metaLeads) * 100).toFixed(2));
    }

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Erro na rota overview:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
