import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

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
      return NextResponse.json({ campaigns: [] });
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
      return NextResponse.json({ error: 'Credenciais Meta não encontradas ou inválidas' }, { status: 403 });
    }

    // 4. Consultar Meta Graph API para campanhas (Nível básico MVP)
    const metaUrl = `https://graph.facebook.com/v19.0/${connection.ad_account_id}/campaigns?fields=id,name,status,effective_status,created_time&limit=500&access_token=${secret.access_token}`;
    
    const metaRes = await fetch(metaUrl);
    const metaData = await metaRes.json();

    if (metaData.error) {
      console.error('Meta API Error:', metaData.error);
      if (metaData.error.code === 190) {
        return NextResponse.json({ error: 'Sua conexão Meta expirou. Gere um novo token estendido e reconecte em Configurações → SyncoMetrics.' }, { status: 401 });
      }
      return NextResponse.json({ error: 'Erro ao consultar campanhas da Meta' }, { status: 500 });
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
