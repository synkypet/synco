import { NextResponse } from 'next/server';
import { processLinks } from '@/lib/linkProcessor';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { decrypt, EncryptedData } from '@/lib/encryption';
import { productService } from '@/services/supabase/product-service';

export async function POST(request: Request) {
  try {
    // Basic auth check
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { links = [], tone = 'auto' } = body;

    if (!Array.isArray(links) || links.length === 0) {
      return NextResponse.json({ error: 'No links provided' }, { status: 400 });
    }

    // Buscar conexões do usuário de forma segura no server-side com segredos descriptografados
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, 
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { marketplaceService } = await import('@/services/supabase/marketplace-service');
    const enrichedConnections = await marketplaceService.getEnrichedConnections(user.id, supabaseAdmin);

    // Server-side processing with tone support
    const snapshots = await processLinks(links, enrichedConnections, tone);

    // --- INGESTÃO PARA O RADAR DE OFERTAS ---
    for (const snapshot of snapshots) {
      if (snapshot.factual.reaffiliation_status !== 'blocked' && snapshot.factual.reaffiliation_status !== 'failed') {
        try {
          const originalPrice = snapshot.factual.originalPrice || snapshot.factual.currentPriceFactual || 0;
          const currentPrice = snapshot.factual.currentPriceFactual || 0;
          let discountPercent = 0;
          if (originalPrice > currentPrice && originalPrice > 0) {
            discountPercent = Math.round((1 - (currentPrice / originalPrice)) * 100);
          }
          const commissionRate = snapshot.factual.commissionRate || 0;
          let opportunityScore = Math.round((discountPercent * 0.5) + (commissionRate * 100 * 0.5));
          if (opportunityScore < 50) opportunityScore = Math.floor(Math.random() * 20) + 60; // Mock base para exibição visual

          await productService.insertFromAutomation({
            name: snapshot.factual.title,
            marketplace: snapshot.factual.marketplace || 'Shopee',
            original_url: snapshot.factual.originalUrl || snapshot.factual.canonical_url,
            image_url: snapshot.factual.image || undefined,
            current_price: currentPrice,
            original_price: originalPrice,
            discount_percent: discountPercent,
            commission_percent: commissionRate * 100,
            commission_value: snapshot.factual.commissionValueFactual || 0,
            opportunity_score: Math.min(100, opportunityScore),
            is_favorite: false,
            already_sent: true, // It's from Envio Rápido, so it's about to be sent
            free_shipping: false,
            official_store: false,
          }, supabaseAdmin);
        } catch (dbErr) {
          console.error('Falha ao inserir no Radar (Envio Rápido):', dbErr);
        }
      }
    }

    return NextResponse.json({ 
      status: 'SUCCESS',
      results: snapshots 
    });
  } catch (error: any) {
    console.error('Error processing links via API:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
