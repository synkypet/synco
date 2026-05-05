
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ShopeeAffiliateClient } from '@/lib/shopee-affiliate/client';

export const dynamic = 'force-dynamic';

/**
 * Cron para atualizar links de afiliado das páginas de cupons curadas.
 */
export async function GET(request: Request) {
  const rid = Math.random().toString(36).substring(7);
  console.log(`[CRON-COUPON-PAGES] [${rid}] Iniciando refresh de páginas curadas...`);

  try {
    // 1. Auth Check (HMAC ou Secret simples via Header/Query)
    const { searchParams } = new URL(request.url);
    const cronSecret = request.headers.get('x-cron-secret') || searchParams.get('key');
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      console.warn(`[CRON-COUPON-PAGES] [${rid}] Unauthorized attempt.`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // 2. Buscar páginas ativas
    const { data: pages, error: fetchError } = await supabase
      .from('shopee_coupon_pages')
      .select('*')
      .eq('is_active', true);

    if (fetchError) throw fetchError;
    if (!pages || pages.length === 0) {
      return NextResponse.json({ message: 'No active coupon pages found.' });
    }

    // 3. Inicializar Cliente Shopee (Usando credenciais do sistema)
    const shopeeClient = new ShopeeAffiliateClient({
      appId: process.env.SHOPEE_APP_ID || '',
      secret: process.env.SHOPEE_APP_SECRET || ''
    });

    const results = {
      total: pages.length,
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    // 4. Processamento Serial (Fire-and-forget por registro)
    for (const page of pages) {
      try {
        console.log(`[CRON-COUPON-PAGES] [${rid}] Processando: ${page.name} (${page.original_url})`);
        
        const shortLink = await shopeeClient.generateShortLink(page.original_url);

        if (!shortLink || shortLink === page.original_url) {
          throw new Error('API retornou link original ou vazio');
        }

        const { error: updateError } = await supabase
          .from('shopee_coupon_pages')
          .update({
            short_link: shortLink,
            last_refreshed_at: new Date().toISOString()
          })
          .eq('id', page.id);

        if (updateError) throw updateError;

        results.success++;
        console.log(`[CRON-COUPON-PAGES] [${rid}] ✓ ${page.name} atualizado: ${shortLink}`);

      } catch (err: any) {
        results.failed++;
        const errMsg = `${page.name}: ${err.message}`;
        results.errors.push(errMsg);
        console.error(`[CRON-COUPON-PAGES] [${rid}] ✗ Erro em ${page.name}:`, err.message);
      }
    }

    return NextResponse.json({
      status: results.failed === 0 ? 'SUCCESS' : 'PARTIAL_SUCCESS',
      requestId: rid,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error(`[CRON-COUPON-PAGES] [${rid}] FATAL ERROR:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
