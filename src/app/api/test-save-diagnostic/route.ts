import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { encrypt } from '@/lib/encryption';

export async function GET() {
  try {
    const results: any = {
      env: {
        NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        SYNCO_MASTER_KEY_SET: !!process.env.SYNCO_MASTER_KEY,
        SYNCO_MASTER_KEY_LENGTH: process.env.SYNCO_MASTER_KEY?.length || 0
      },
      db_checks: {}
    };

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Verificar colunas em user_marketplaces
    const { data: marketplaceRow, error: tableErr } = await supabaseAdmin
      .from('user_marketplaces')
      .select('*')
      .limit(1)
      .single();
    
    if (tableErr) {
      results.db_checks.user_marketplaces = { error: tableErr.message };
    } else {
      results.db_checks.user_marketplaces = {
        exists: true,
        has_shopee_app_id: 'shopee_app_id' in marketplaceRow,
        has_has_secret: 'has_secret' in marketplaceRow
      };
    }

    // 2. Verificar se a tabela de secrets existe
    const { error: secretTableErr } = await supabaseAdmin
      .from('user_marketplace_secrets')
      .select('count', { count: 'exact', head: true });
    
    if (secretTableErr) {
      results.db_checks.user_marketplace_secrets = { error: secretTableErr.message };
    } else {
      results.db_checks.user_marketplace_secrets = { exists: true };
    }

    // 3. Teste de Criptografia e Escrita
    try {
      const keyLen = process.env.SYNCO_MASTER_KEY?.length || 0;
      if (keyLen === 32 || keyLen === 64) {
        const dummy = encrypt("test_secret_123");
        results.encryption_test = "SUCCESS";
        
        // Tentar escrita dummy se houver um user/marketplace id (pegando do passo 1)
        if (marketplaceRow) {
           const { error: writeErr } = await supabaseAdmin
             .from('user_marketplace_secrets')
             .upsert({
               user_id: marketplaceRow.user_id,
               marketplace_id: marketplaceRow.marketplace_id,
               encrypted_secret: dummy.encryptedValue,
               iv: dummy.iv,
               auth_tag: dummy.authTag,
               updated_at: new Date().toISOString()
             });
           results.db_write_test = writeErr ? { status: "FAIL", error: writeErr.message } : "SUCCESS";
        }
      } else {
        results.encryption_test = `SKIP (Master Key length ${keyLen} is invalid)`;
      }
    } catch (encryptErr: any) {
      results.encryption_test = { status: "FAIL", error: encryptErr.message };
    }

    return NextResponse.json(results);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
