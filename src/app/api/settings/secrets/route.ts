import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { encrypt } from '@/lib/encryption';

export async function POST(request: Request) {
  try {
    // Basic Auth Check
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { marketplace_id, secret, shopee_app_id } = body;

    if (!marketplace_id || !secret) {
      return NextResponse.json({ error: 'Faltam dados obrigatórios' }, { status: 400 });
    }

    if (!process.env.SYNCO_MASTER_KEY || process.env.SYNCO_MASTER_KEY.length !== 64) {
      console.error('SERVER ERROR: SYNCO_MASTER_KEY ausente ou inválida. Não é possível instanciar segredo.');
      return NextResponse.json({ error: 'Configuração de criptografia ausente no servidor.' }, { status: 500 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SERVER ERROR: SUPABASE_SERVICE_ROLE_KEY ausente.');
      return NextResponse.json({ error: 'Configuração de banco de dados ausente no servidor.' }, { status: 500 });
    }

    // 1. Encripta no Side de Segurança
    const encryptedData = encrypt(secret);

    // 2. Acesso à Tabela Privada requer Admin Service Role
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, 
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: upsertError } = await supabaseAdmin
      .from('user_marketplace_secrets')
      .upsert({
        user_id: user.id,
        marketplace_id: marketplace_id,
        encrypted_secret: encryptedData.encryptedValue,
        iv: encryptedData.iv,
        auth_tag: encryptedData.authTag,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id, marketplace_id' });

    if (upsertError) {
      console.error('Falha ao salvar segredo criptografado:', upsertError.message);
      return NextResponse.json({ error: 'Falha interna ao armazenar credencial.' }, { status: 500 });
    }

    // 3. Atualizar o registro público do usuário em user_marketplaces
    const { error: connectionError } = await supabaseAdmin
      .from('user_marketplaces')
      .upsert({
        user_id: user.id,
        marketplace_id: marketplace_id,
        shopee_app_id: shopee_app_id || null,
        has_secret: true,
        connection_status: 'configured',
        last_error: null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id, marketplace_id' });

    if (connectionError) {
      console.error('Falha ao atualizar status da conexão de marketplace:', connectionError.message);
      return NextResponse.json({ error: 'Falha interna ao atualizar status.' }, { status: 500 });
    }

    return NextResponse.json({ 
      ok: true,
      status: 'configured' 
    });
    
  } catch (error: any) {
    console.error('Error on secret encryption route:', error.message || 'Unknown error');
    return NextResponse.json({ error: 'Erro interno ao processar credencial.' }, { status: 500 });
  }
}
