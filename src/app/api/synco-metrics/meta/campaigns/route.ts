import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { fetchMetaWithCacheAndLimit } from '@/lib/meta-api';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // 1. Validar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 2. Buscar conexão Meta do usuário
    const { data: connection } = await supabase
      .from('sm_meta_connections')
      .select('id, ad_account_id')
      .eq('user_id', user.id)
      .single();

    if (!connection) {
      return NextResponse.json({ 
        error: 'META_NOT_CONNECTED', 
        message: 'Conecte sua conta Meta Ads em Configurações → SyncoMetrics.' 
      }, { status: 400 });
    }

    // 3. Buscar secret com service role
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada');
    }

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
      return NextResponse.json({ 
        error: 'META_NOT_CONNECTED', 
        message: 'Credenciais Meta não encontradas ou inválidas. Reconecte sua conta Meta Ads em Configurações → SyncoMetrics.' 
      }, { status: 403 });
    }

    // 4. Consultar Meta Graph API para campanhas (Nível básico MVP)
    const metaUrl = `https://graph.facebook.com/v19.0/${connection.ad_account_id}/campaigns?fields=id,name,status,effective_status,created_time&limit=500`;
    
    let metaData;
    try {
      metaData = await fetchMetaWithCacheAndLimit(metaUrl, secret.access_token, user.id);
    } catch (err: any) {
      if (err.message === 'META_RATE_LIMIT_EXCEEDED') {
        return NextResponse.json({ 
          error: 'META_RATE_LIMIT_EXCEEDED', 
          message: 'Muitas requisições. Aguarde um instante.' 
        }, { status: 429 });
      }
      throw err;
    }

    if (metaData.error) {
      const safeError = { ...metaData.error };
      if (safeError.message && typeof safeError.message === 'string') {
        safeError.message = safeError.message.replace(secret.access_token, '[REDACTED_TOKEN]');
      }
      
      console.error('[Meta Campaigns] Error', {
        code: safeError.code,
        message: safeError.message,
        status: safeError.error_subcode || safeError.status,
        userId: user.id
      });

      if (metaData.error.code === 190) {
        return NextResponse.json({ 
          error: 'META_TOKEN_EXPIRED', 
          message: 'Sua conexão Meta expirou. Gere um novo token estendido e reconecte em Configurações → SyncoMetrics.' 
        }, { status: 401 });
      }
      
      if (metaData.error.code === 10 || metaData.error.code === 200) {
        return NextResponse.json({ 
          error: 'META_PERMISSION_DENIED', 
          message: 'A conexão Meta não tem permissão para ler campanhas. Reconecte usando a permissão ads_read.' 
        }, { status: 403 });
      }

      return NextResponse.json({ 
        error: 'META_API_ERROR', 
        message: 'Não foi possível consultar a Meta no momento. Tente novamente em instantes.' 
      }, { status: 502 });
    }

    // Ordenar as campanhas ativas primeiro e depois por data de criação mais recente
    const campaigns = metaData.data || [];
    
    const sortedCampaigns = campaigns.sort((a: any, b: any) => {
      const aActive = a.effective_status === 'ACTIVE';
      const bActive = b.effective_status === 'ACTIVE';
      
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      
      const aDate = new Date(a.created_time || 0).getTime();
      const bDate = new Date(b.created_time || 0).getTime();
      
      return bDate - aDate;
    });

    return NextResponse.json({ campaigns: sortedCampaigns });
  } catch (error: any) {
    console.error('Erro na rota de campaigns:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
