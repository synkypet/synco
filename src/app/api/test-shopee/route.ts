import { NextResponse } from 'next/server';
import { processLinks } from '@/lib/linkProcessor';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/encryption';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const link = searchParams.get('url') || 'https://shopee.com.br/Patinete-El%C3%A9trico-De-350w-Com-Uma-Bateria-De-Alta-Alcan%C3%A7a-Velocidades-De-25-30km-h-Com-Autonomia-De-4-5-Horas-i.1235724103.58204359689?extraParams=%7B%22display_model_id%22%3A109728052788%2C%22model_selection_logic%22%3A3%7D';
    
    // We will bypass actual auth extraction for this test endpoint to get the first valid Shopee setup in DB.
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, 
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get the first user who has a Shopee API key configured
    const { data: userMarketplace } = await supabaseAdmin
      .from('user_marketplaces')
      .select('*, marketplaces!inner(*)')
      .eq('marketplaces.name', 'Shopee')
      .limit(1)
      .single();

    if (!userMarketplace) {
      return NextResponse.json({ error: 'Nenhum usuário configurado com Shopee encontrado para o teste.' }, { status: 400 });
    }

    let appSecret = '';

    if (userMarketplace.has_secret) {
      const { data: secretRow } = await supabaseAdmin
        .from('user_marketplace_secrets')
        .select('encrypted_secret, iv, auth_tag')
        .eq('user_id', userMarketplace.user_id)
        .eq('marketplace_id', userMarketplace.marketplace_id)
        .single();
        
      if (secretRow) {
        try {
          appSecret = decrypt({
            encryptedValue: secretRow.encrypted_secret,
            iv: secretRow.iv,
            authTag: secretRow.auth_tag
          });
        } catch (cryptoErr) {
          return NextResponse.json({ error: 'DECRYPT_FAIL', cryptoErr });
        }
      }
    }

    const mockEnrichedConn = {
      ...userMarketplace,
      marketplace_name: 'Shopee',
      shopee_app_secret: appSecret
    };

    const results = await processLinks([link], [mockEnrichedConn]);

    return NextResponse.json({ 
      step: "COMPLETED_PROCESS",
      targetUrl: link,
      usedCredentials: {
        app_id: userMarketplace.shopee_app_id,
        has_secret_in_db: userMarketplace.has_secret,
        decrypted_secret_length: appSecret.length
      },
      results 
    });

  } catch (error: any) {
    return NextResponse.json({ error: 'PIPELINE_CRASH', message: error.message, stack: error.stack }, { status: 500 });
  }
}
