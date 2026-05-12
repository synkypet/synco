import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/encryption';
import { ShopeeAffiliateClient } from '@/lib/shopee-affiliate/client';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { marketplace_id } = body;

    if (!marketplace_id) {
      return NextResponse.json({ error: 'Faltam dados obrigatórios' }, { status: 400 });
    }

    // 1. Verificar configuração básica e obter o nome do marketplace
    const { data: connection, error: connError } = await supabase
      .from('user_marketplaces')
      .select('*, marketplaces(name)')
      .eq('user_id', user.id)
      .eq('marketplace_id', marketplace_id)
      .single();

    if (!connection || connError) {
      return NextResponse.json({ valid: false, message: 'Conexão não encontrada.' });
    }

    const marketplaceName = (connection as any).marketplaces?.name || '';
    const isShopee = marketplaceName.toLowerCase().includes('shopee');

    // 2. Acesso à Tabela Privada requer Admin Service Role
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SERVER ERROR: SUPABASE_SERVICE_ROLE_KEY ausente.');
      return NextResponse.json({ valid: false, message: 'Configuração de banco ausente no servidor.' }, { status: 500 });
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, 
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Buscar segredo (Decriptação real para a Shopee)
    const { data: secretData } = await supabaseAdmin
      .from('user_marketplace_secrets')
      .select('encrypted_secret, iv, auth_tag')
      .eq('user_id', user.id)
      .eq('marketplace_id', marketplace_id)
      .single();

    if (!secretData || !connection.has_secret || (isShopee && !connection.shopee_app_id)) {
      await supabaseAdmin.from('user_marketplaces').update({
        connection_status: 'error',
        last_error: 'Credenciais ausentes ou incompletas.',
        last_verified_at: new Date().toISOString()
      }).eq('user_id', user.id).eq('marketplace_id', marketplace_id);

      return NextResponse.json({ valid: false, message: 'Credenciais inválidas ou incompletas.' });
    }

    // 4. Teste Real com a API (Apenas para Shopee no momento)
    if (!isShopee) {
      await supabaseAdmin.from('user_marketplaces').update({
        connection_status: 'connected',
        last_error: null,
        last_verified_at: new Date().toISOString()
      }).eq('user_id', user.id).eq('marketplace_id', marketplace_id);

      return NextResponse.json({ 
        valid: true, 
        message: 'Conexão validada localmente para ' + marketplaceName 
      });
    }

    try {
      const decryptedSecret = decrypt({
        encryptedValue: secretData.encrypted_secret,
        iv: secretData.iv,
        authTag: secretData.auth_tag
      });

      const shopeeClient = new ShopeeAffiliateClient({
        appId: connection.shopee_app_id,
        secret: decryptedSecret
      });

      // Busca leve para testar a conexão (ex: 1 produto)
      await shopeeClient.searchProducts({ limit: 1 });

      // Se chegou aqui, a API respondeu OK
      await supabaseAdmin.from('user_marketplaces').update({
        connection_status: 'connected',
        last_error: null,
        last_verified_at: new Date().toISOString()
      }).eq('user_id', user.id).eq('marketplace_id', marketplace_id);

      return NextResponse.json({ 
        valid: true, 
        message: 'Shopee conectada com sucesso!' 
      });

    } catch (apiError: any) {
      console.error('Shopee API Validation Error:', apiError.message);
      
      await supabaseAdmin.from('user_marketplaces').update({
        connection_status: 'error',
        last_error: `Falha na API Shopee: ${apiError.message}`,
        last_verified_at: new Date().toISOString()
      }).eq('user_id', user.id).eq('marketplace_id', marketplace_id);

      return NextResponse.json({ 
        valid: false, 
        message: `Falha na Shopee: ${apiError.message}` 
      });
    }

  } catch (error: any) {
    console.error('Error testing connection:', error);
    return NextResponse.json({ valid: false, message: 'Erro ao testar a conexão.' }, { status: 500 });
  }
}
