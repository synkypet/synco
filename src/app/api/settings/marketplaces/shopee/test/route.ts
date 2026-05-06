import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { ShopeeAffiliateClient } from '@/lib/shopee-affiliate/client';
import { decrypt } from '@/lib/encryption';

export async function POST() {
  try {
    // 1. Autenticação básica
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ valid: false, message: 'Não autorizado.' }, { status: 401 });
    }

    // 2. Acesso ao banco via Admin para ler segredos (tabela privada)
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Buscar o marketplace ID da Shopee
    const { data: marketplace, error: mkError } = await supabaseAdmin
      .from('marketplaces')
      .select('id')
      .eq('name', 'Shopee')
      .single();

    if (mkError || !marketplace) {
      return NextResponse.json({ 
        valid: false, 
        message: 'Marketplace Shopee não encontrado no catálogo.' 
      }, { status: 404 });
    }

    // 4. Buscar a conexão do usuário (para pegar o appId)
    const { data: connection, error: connError } = await supabaseAdmin
      .from('user_marketplaces')
      .select('shopee_app_id')
      .eq('user_id', user.id)
      .eq('marketplace_id', marketplace.id)
      .single();

    if (connError || !connection?.shopee_app_id) {
      return NextResponse.json({ 
        valid: false, 
        message: 'Credenciais (AppID) não encontradas. Configure-as primeiro.' 
      });
    }

    // 5. Buscar o segredo criptografado
    const { data: secretRow, error: secretError } = await supabaseAdmin
      .from('user_marketplace_secrets')
      .select('encrypted_secret, iv, auth_tag')
      .eq('user_id', user.id)
      .eq('marketplace_id', marketplace.id)
      .single();

    if (secretError || !secretRow) {
      return NextResponse.json({ 
        valid: false, 
        message: 'Senha da API não encontrada. Por favor, reinjete sua senha.' 
      });
    }

    // 6. Descriptografar
    let decryptedSecret = '';
    try {
      decryptedSecret = decrypt({
        encryptedValue: secretRow.encrypted_secret,
        iv: secretRow.iv,
        authTag: secretRow.auth_tag
      });
    } catch (decryptErr) {
      return NextResponse.json({ 
        valid: false, 
        message: 'Falha ao descriptografar segredo. Verifique a chave mestre do servidor.' 
      });
    }

    // 7. Testar conexão real
    const client = new ShopeeAffiliateClient({
      appId: connection.shopee_app_id,
      secret: decryptedSecret
    });

    try {
      // Teste leve: busca ofertas com limite 1
      await client.searchProducts({ limit: 1 });
      
      return NextResponse.json({ 
        valid: true, 
        message: 'Conexão com a Shopee confirmada! Suas credenciais estão corretas.' 
      });
    } catch (apiErr: any) {
      console.error('[SHOPEE-TEST-API] Error:', apiErr.message);
      
      // Tratamento amigável de erros comuns da Shopee API
      if (apiErr.message.includes('401') || apiErr.message.includes('Signature')) {
        return NextResponse.json({ 
          valid: false, 
          message: 'Credenciais inválidas ou erro de assinatura. Verifique seu AppID e Senha.' 
        });
      }

      return NextResponse.json({ 
        valid: false, 
        message: `Erro na Shopee: ${apiErr.message}` 
      });
    }

  } catch (error: any) {
    console.error('[SHOPEE-TEST-ROUTE] Fatal:', error);
    return NextResponse.json({ 
      valid: false, 
      message: 'Erro interno ao processar o teste de conexão.' 
    }, { status: 500 });
  }
}
