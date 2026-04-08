import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/encryption';
import { ShopeeAffiliateClient } from '@/lib/shopee-affiliate/client';

export async function POST() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Buscar a conexão e o ID do marketplace para Shopee
    const { data: connection, error: connError } = await supabaseAdmin
      .from('user_marketplaces')
      .select('*, marketplaces!inner(*)')
      .eq('user_id', user.id)
      .eq('marketplaces.name', 'Shopee')
      .single();

    if (connError || !connection) {
      return NextResponse.json({ 
        valid: false, 
        stage: 'database_lookup', 
        message: 'Conexão Shopee não encontrada para este usuário.' 
      });
    }

    if (!connection.shopee_app_id) {
      return NextResponse.json({ 
        valid: false, 
        stage: 'validation', 
        message: 'AppID não configurado.' 
      });
    }

    // 2. Buscar o segredo criptografado
    const { data: secretData, error: secretError } = await supabaseAdmin
      .from('user_marketplace_secrets')
      .select('*')
      .eq('user_id', user.id)
      .eq('marketplace_id', connection.marketplace_id)
      .single();

    if (secretError || !secretData) {
      return NextResponse.json({ 
        valid: false, 
        stage: 'secret_lookup', 
        message: 'Senha da API não encontrada no cofre seguro.' 
      });
    }

    // 3. Descriptografar
    let shopeeSecret: string;
    try {
      shopeeSecret = decrypt({
        encryptedValue: secretData.encrypted_secret,
        iv: secretData.iv,
        authTag: secretData.auth_tag
      });
    } catch (err: any) {
      return NextResponse.json({ 
        valid: false, 
        stage: 'decryption', 
        message: 'Erro ao descriptografar chave. Verifique o MASTER_KEY.' 
      });
    }

    // 4. Testar Handshake com Shopee
    const client = new ShopeeAffiliateClient({
      appId: connection.shopee_app_id,
      secret: shopeeSecret
    });

    // Usar uma URL real e válida para o teste (Patinete do user)
    const testUrl = 'https://shopee.com.br/Patinete-El%C3%A9trico-De-350w-Com-Uma-Bateria-De-Alta-Alcan%C3%A7a-Velocidades-De-25-30km-h-Com-Autonomia-De-4-5-Horas-i.1235724103.58204359689';
    
    try {
      const shortLink = await client.generateShortLink(testUrl);
      
      return NextResponse.json({ 
        valid: true, 
        message: 'Conexão estabelecida com sucesso!',
        test_result: {
          short_link: shortLink
        }
      });
    } catch (shopeeErr: any) {
      return NextResponse.json({ 
        valid: false, 
        stage: 'shopee_api', 
        message: `A Shopee recusou a conexão: ${shopeeErr.message}` 
      });
    }

  } catch (error: any) {
    return NextResponse.json({ 
      valid: false, 
      stage: 'internal_error', 
      message: error.message 
    }, { status: 500 });
  }
}
