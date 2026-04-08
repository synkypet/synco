import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { ShopeeAdapter } from '@/lib/marketplaces/ShopeeAdapter';

export async function GET(request: Request) {
  try {
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, 
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Fetch the current Shopee connection for ANY user
    const { data: userMarketplace } = await supabaseAdmin
      .from('user_marketplaces')
      .select('*, marketplaces!inner(*)')
      .eq('marketplaces.name', 'Shopee')
      .limit(1)
      .single();

    if (!userMarketplace) {
      return NextResponse.json({ error: 'No user configs found' }, { status: 400 });
    }

    // 3. Forçar um teste de ESCRITA REAL no banco para provar que a coluna mapeia e salva
    const testId = 'AN_' + Math.floor(Math.random() * 1000000);
    const { error: updateErr, data: updatedData } = await supabaseAdmin
      .from('user_marketplaces')
      .update({ affiliate_id: testId, is_active: true })
      .eq('user_id', userMarketplace.user_id)
      .eq('marketplace_id', userMarketplace.marketplace_id)
      .select('affiliate_id, is_active')
      .single();

    if (updateErr) {
      return NextResponse.json({ error: 'DB_WRITE_FAIL', details: updateErr });
    }

    // 4. Simular o Fallback do ShopeeAdapter injetando a conexão RECÉM SALVA no banco real
    const adapter = new ShopeeAdapter();
    const testUrl = 'https://shopee.com.br/Patinete-El%C3%A9trico-De-350w-Com-Uma-Bateria-De-Alta-Alcan%C3%A7a-Velocidades-De-25-30km-h-Com-Autonomia-De-4-5-Horas-i.1235724103.58204359689';
    
    // Injetar os valores que acabaram de ser persistidos de verdade
    const fallbackConn = {
      ...userMarketplace,
      is_active: updatedData.is_active,
      affiliate_id: updatedData.affiliate_id,
      shopee_app_id: '',
      shopee_app_secret: ''
    };

    const fallbackResult = await adapter.generateAffiliateLink(testUrl, fallbackConn);

    return NextResponse.json({
       db_persisted_state_before: {
         is_active: userMarketplace.is_active,
         affiliate_id: userMarketplace.affiliate_id
       },
       db_active_write_test: {
         status: "SUCCESS",
         written_affiliate_id: updatedData.affiliate_id,
         written_is_active: updatedData.is_active
       },
       fallback_test: {
         url_raw: testUrl,
         generated_link: fallbackResult
       }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
