// src/app/api/radar/audit/bulk/route.ts
import { NextResponse } from 'next/server';
import { processLinks } from '@/lib/linkProcessor';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { marketplaceService } from '@/services/supabase/marketplace-service';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productIds } = await request.json();

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'Product IDs array is required' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // 1. Buscar produtos no banco
    const { data: products, error: fetchError } = await supabaseAdmin
      .from('products')
      .select('*')
      .in('id', productIds);

    if (fetchError || !products) {
      return NextResponse.json({ error: 'Products not found' }, { status: 404 });
    }

    // 2. Buscar conexões do usuário
    const connections = await marketplaceService.getEnrichedConnections(user.id, supabaseAdmin);

    // 3. Executar processamento em lote (Aproveitando a otimização nativa do processLinks)
    const urls = products.map(p => p.original_url);
    const snapshots = await processLinks(urls, connections, 'auto');

    const results = {
      verified: productIds.length,
      eligible: 0,
      review: 0,
      dead: 0,
      failed: 0
    };

    // 4. Preparar atualizações em massa
    const updates = products.map((product, index) => {
      const snapshot = snapshots[index];
      if (!snapshot) return null;

      const factual = snapshot.factual;
      const eligibility = factual.eligibility;
      const reaf = factual.reaffiliation_status;

      let finalStatus = 'audit_failed';
      if (reaf === 'failed' || reaf === 'blocked' || factual.title === 'PRODUTO BLOQUEADO') {
          finalStatus = 'dead';
          results.dead++;
      } else if (eligibility.isEligible) {
          finalStatus = 'eligible';
          results.eligible++;
      } else if (reaf === 'success') {
          finalStatus = 'review_needed';
          results.review++;
      } else {
          results.failed++;
      }

      return {
        id: product.id,
        name: finalStatus !== 'audit_failed' ? factual.title : product.name,
        image_url: finalStatus !== 'audit_failed' ? factual.image : product.image_url,
        current_price: finalStatus !== 'audit_failed' ? factual.price : product.current_price,
        original_price: finalStatus !== 'audit_failed' ? factual.originalPrice : product.original_price,
        commission_value: finalStatus !== 'audit_failed' ? factual.commissionValueFactual : product.commission_value,
        commission_percent: (finalStatus !== 'audit_failed' && factual.commissionRate) ? factual.commissionRate * 100 : product.commission_percent,
        status: finalStatus,
        updated_at: new Date().toISOString()
      };
    }).filter(Boolean);

    // 5. Executar upsert no banco (Update via Supabase)
    const { error: updateError } = await supabaseAdmin
      .from('products')
      .upsert(updates);

    if (updateError) throw updateError;

    return NextResponse.json({
      status: 'SUCCESS',
      results
    });

  } catch (error: any) {
    console.error('Error in bulk audit:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
