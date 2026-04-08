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
    const { marketplace_id, secret } = body;

    if (!marketplace_id || !secret) {
      return NextResponse.json({ error: 'Faltam dados obrigatórios' }, { status: 400 });
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
      console.error('Falha ao salvar segredo criptografado:', upsertError);
      return NextResponse.json({ error: 'Falha interna ao injetar segredo' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('Error on secret encryption route:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
