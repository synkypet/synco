import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canUseSyncoMetrics } from '@/lib/synco-metrics';

export const dynamic = 'force-dynamic';

const META_GRAPH_API_VERSION = 'v20.0';
const META_BASE_URL = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ connected: false }, { status: 401 });
    }

    const hasAccess = await canUseSyncoMetrics(user.id);
    if (!hasAccess) {
      return NextResponse.json({ connected: false }, { status: 403 });
    }

    const { data: connection, error } = await supabase
      .from('sm_meta_connections')
      .select('ad_account_id, ad_account_name, currency, account_status, pixel_name, last_tested_at, connection_status')
      .eq('user_id', user.id)
      .eq('connection_status', 'connected')
      .single();

    if (error || !connection) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      account: {
        adAccountId: connection.ad_account_id,
        name: connection.ad_account_name,
        currency: connection.currency,
        status: connection.account_status,
        pixelName: connection.pixel_name,
        lastTestedAt: connection.last_tested_at
      }
    });

  } catch (error: any) {
    console.error('[SYNCOMETRICS-META-GET]', error);
    return NextResponse.json({ connected: false });
  }
}

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

    // Validação na Meta API
    const fetchMeta = async (endpoint: string, params: Record<string, string> = {}) => {
      const url = new URL(`${META_BASE_URL}${endpoint}`);
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, value);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      const data = await response.json();

      if (!response.ok) {
        let errorMsg = data.error?.message || 'Erro desconhecido na Meta API';
        errorMsg = errorMsg.replace(accessToken, '[REDACTED_TOKEN]');
        throw new Error(errorMsg);
      }
      return data;
    };

    let accountName = '';
    let accountStatus = '';
    let accountCurrency = '';
    let timezone = '';
    let pixelName = null;
    let pixelStatus = null;

    try {
      await fetchMeta('/me', { fields: 'id,name' });
    } catch (e: any) {
      return NextResponse.json({ ok: false, stage: 'token', error: `Falha ao validar token: ${e.message}` }, { status: 400 });
    }

    try {
      const accountData = await fetchMeta(`/${adAccountId}`, { fields: 'name,account_status,currency,timezone_name' });
      accountName = accountData.name;
      accountStatus = accountData.account_status;
      accountCurrency = accountData.currency;
      timezone = accountData.timezone_name;
    } catch (e: any) {
      return NextResponse.json({ ok: false, stage: 'account', error: `Conta de anúncios inválida ou inacessível: ${e.message}` }, { status: 400 });
    }

    if (pixelId && pixelId.trim() !== '') {
      try {
        const pixelData = await fetchMeta(`/${pixelId}`, { fields: 'name,creation_time,last_fired_time' });
        pixelName = pixelData.name;
        pixelStatus = pixelData.last_fired_time ? 'active' : 'inactive';
      } catch (e: any) {
        return NextResponse.json({ ok: false, stage: 'pixel', error: `Pixel inválido ou inacessível: ${e.message}` }, { status: 400 });
      }
    }

    // Validou tudo, agora salva no banco
    // 1. Upsert em sm_meta_connections com dados seguros usando Supabase autenticado
    const { data: connection, error: connError } = await supabase
      .from('sm_meta_connections')
      .upsert({
        user_id: user.id,
        ad_account_id: adAccountId,
        ad_account_name: accountName,
        account_status: accountStatus,
        currency: accountCurrency,
        timezone_name: timezone,
        pixel_id: pixelId || null,
        pixel_name: pixelName,
        pixel_status: pixelStatus,
        connection_status: 'connected',
        last_tested_at: new Date().toISOString()
      }, { onConflict: 'user_id,ad_account_id' })
      .select('id')
      .single();

    if (connError || !connection) {
      return NextResponse.json({ ok: false, error: 'Erro ao salvar metadados da conexão' }, { status: 500 });
    }

    // 2. Usar service role APENAS para salvar o secret em sm_meta_secrets
    const { createClient: createAdminClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: secretError } = await supabaseAdmin
      .from('sm_meta_secrets')
      .upsert({
        user_id: user.id,
        connection_id: connection.id,
        access_token: accessToken,
        token_type: 'user'
      }, { onConflict: 'connection_id' });

    if (secretError) {
      // Se falhar o secret, deveríamos talvez reverter o connection, mas connection é inofensivo.
      return NextResponse.json({ ok: false, error: 'Erro crítico ao salvar token' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      account: {
        adAccountId: adAccountId,
        name: accountName,
        currency: accountCurrency,
        status: accountStatus,
        pixelName: pixelName,
        lastTestedAt: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('[SYNCOMETRICS-META-CONNECT]', error);
    return NextResponse.json({ ok: false, stage: 'general', error: 'Erro interno ao conectar' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    const { data: connection } = await supabase
      .from('sm_meta_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('connection_status', 'connected')
      .single();

    if (!connection) {
      return NextResponse.json({ ok: true }); // Já está desconectado
    }

    // Delete secret via service role
    const { createClient: createAdminClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabaseAdmin
      .from('sm_meta_secrets')
      .delete()
      .eq('connection_id', connection.id);

    // Update connection status
    await supabase
      .from('sm_meta_connections')
      .update({ connection_status: 'disconnected' })
      .eq('id', connection.id);

    return NextResponse.json({ ok: true });

  } catch (error: any) {
    console.error('[SYNCOMETRICS-META-DISCONNECT]', error);
    return NextResponse.json({ ok: false, error: 'Erro ao desconectar' }, { status: 500 });
  }
}
