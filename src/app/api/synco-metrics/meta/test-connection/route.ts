import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canUseSyncoMetrics } from '@/lib/synco-metrics';

export const dynamic = 'force-dynamic';

const META_GRAPH_API_VERSION = 'v20.0';
const META_BASE_URL = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const hasAccess = await canUseSyncoMetrics(user.id);
    if (!hasAccess) {
      return NextResponse.json({ ok: false, error: 'Plano não permite uso do SyncoMetrics' }, { status: 403 });
    }

    const body = await request.json();
    const { accessToken, adAccountId, pixelId } = body;

    if (!accessToken || !adAccountId) {
      return NextResponse.json({ ok: false, error: 'Token e Ad Account ID são obrigatórios' }, { status: 400 });
    }

    // Função utilitária para chamar a Meta API de forma segura
    const fetchMeta = async (endpoint: string, params: Record<string, string> = {}) => {
      const url = new URL(`${META_BASE_URL}${endpoint}`);
      url.searchParams.append('access_token', accessToken);
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, value);
      }

      const response = await fetch(url.toString());
      const data = await response.json();

      if (!response.ok) {
        // Sanitiza o erro para não vazar o token caso ele apareça na string de erro
        let errorMsg = data.error?.message || 'Erro desconhecido na Meta API';
        errorMsg = errorMsg.replace(accessToken, '[REDACTED_TOKEN]');
        throw new Error(errorMsg);
      }
      return data;
    };

    let result: any = { ok: true };

    // 1. Validar token e usuário
    try {
      await fetchMeta('/me', { fields: 'id,name' });
    } catch (e: any) {
      return NextResponse.json({ ok: false, stage: 'token', error: `Falha ao validar token: ${e.message}` }, { status: 400 });
    }

    // 2. Validar conta de anúncio
    try {
      const accountData = await fetchMeta(`/${adAccountId}`, { fields: 'name,account_status,currency,timezone_name' });
      result.account = {
        id: accountData.id,
        name: accountData.name,
        accountStatus: accountData.account_status,
        currency: accountData.currency,
        timezone: accountData.timezone_name
      };
    } catch (e: any) {
      return NextResponse.json({ ok: false, stage: 'account', error: `Conta de anúncios inválida ou inacessível: ${e.message}` }, { status: 400 });
    }

    // 3. Validar campanhas
    try {
      const campaignsData = await fetchMeta(`/${adAccountId}/campaigns`, { fields: 'id,name,status,effective_status,objective', limit: '5' });
      result.campaignsSample = campaignsData.data || [];
    } catch (e: any) {
      return NextResponse.json({ ok: false, stage: 'campaigns', error: `Erro ao ler campanhas: ${e.message}` }, { status: 400 });
    }

    // 4. Validar anúncios
    try {
      const adsData = await fetchMeta(`/${adAccountId}/ads`, { fields: 'id,name,status,effective_status,campaign_id,adset_id', limit: '5' });
      result.adsSample = adsData.data || [];
    } catch (e: any) {
      return NextResponse.json({ ok: false, stage: 'ads', error: `Erro ao ler anúncios: ${e.message}` }, { status: 400 });
    }

    // 5. Validar insights
    try {
      const insightsData = await fetchMeta(`/${adAccountId}/insights`, { 
        fields: 'spend,impressions,reach,clicks,ctr,cpc,cpm,actions,cost_per_action_type',
        date_preset: 'last_7d',
        level: 'account'
      });
      
      const insight = insightsData.data && insightsData.data.length > 0 ? insightsData.data[0] : {};
      
      // Coletar raw actions e descobrir leads
      const actionsRawTypes: string[] = [];
      const leadActionsDetected: any[] = [];
      
      if (insight.actions) {
        insight.actions.forEach((act: any) => {
          actionsRawTypes.push(act.action_type);
          if (act.action_type.includes('lead')) {
            leadActionsDetected.push(act);
          }
        });
      }

      result.insights = {
        spend: parseFloat(insight.spend || '0'),
        impressions: parseInt(insight.impressions || '0'),
        reach: parseInt(insight.reach || '0'),
        clicks: parseInt(insight.clicks || '0'),
        ctr: parseFloat(insight.ctr || '0'),
        cpc: parseFloat(insight.cpc || '0'),
        cpm: parseFloat(insight.cpm || '0'),
        actionsRawTypes,
        leadActionsDetected
      };
    } catch (e: any) {
      return NextResponse.json({ ok: false, stage: 'insights', error: `Erro ao ler insights: ${e.message}` }, { status: 400 });
    }

    // 6. Validar pixel (opcional)
    if (pixelId && pixelId.trim() !== '') {
      try {
        const pixelData = await fetchMeta(`/${pixelId}`, { fields: 'name,creation_time,last_fired_time' });
        result.pixel = {
          checked: true,
          ok: true,
          name: pixelData.name,
          lastFiredTime: pixelData.last_fired_time
        };
      } catch (e: any) {
        result.pixel = {
          checked: true,
          ok: false,
          error: `Pixel inválido ou inacessível: ${e.message}`
        };
      }
    } else {
      result.pixel = { checked: false };
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[SYNCOMETRICS-META-TEST]', error);
    return NextResponse.json({ ok: false, stage: 'general', error: 'Erro interno ao testar conexão' }, { status: 500 });
  }
}
