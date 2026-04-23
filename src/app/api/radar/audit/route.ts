// src/app/api/radar/audit/route.ts
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

    const { productId } = await request.json();

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // 1. Buscar o produto atual no banco
    const { data: product, error: fetchError } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (fetchError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // 2. Buscar conexões do usuário para auditoria correta
    const connections = await marketplaceService.getEnrichedConnections(user.id, supabaseAdmin);

    // 3. Executar processamento factual em tempo real
    const snapshots = await processLinks([product.original_url], connections, 'auto');
    const snapshot = snapshots[0];

    if (!snapshot) {
      return NextResponse.json({ error: 'Falha técnica na auditoria' }, { status: 500 });
    }

    const factual = snapshot.factual;
    const eligibility = factual.eligibility;
    const reaf = factual.reaffiliation_status;

    // DETERMINAÇÃO DO STATUS REAL
    let finalStatus = 'audit_failed';
    
    if (reaf === 'failed' || reaf === 'blocked' || factual.title === 'PRODUTO BLOQUEADO') {
        finalStatus = 'dead';
    } else if (eligibility.isEligible) {
        finalStatus = 'eligible';
    } else if (!eligibility.isEligible && reaf === 'success') {
        finalStatus = 'review_needed';
    } else {
        finalStatus = 'audit_failed';
    }

    // 4. Atualizar o registro no banco com os dados auditados (ou marcar falha)
    const updatePayload: any = {
        updated_at: new Date().toISOString(),
        status: finalStatus
    };

    // Só atualizamos metadados se não for um erro técnico puro
    if (finalStatus !== 'audit_failed') {
        updatePayload.name = factual.title;
        updatePayload.image_url = factual.image;
        updatePayload.current_price = factual.price;
        updatePayload.original_price = factual.originalPrice;
        updatePayload.commission_value = factual.commissionValueFactual;
        updatePayload.commission_percent = factual.commissionRate ? factual.commissionRate * 100 : product.commission_percent;
    }

    const { data: updatedProduct, error: updateError } = await supabaseAdmin
      .from('products')
      .update(updatePayload)
      .eq('id', productId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      status: 'SUCCESS',
      product: updatedProduct,
      audit: {
        status: finalStatus,
        isEligible: eligibility.isEligible,
        reasons: eligibility.reasons,
        reaffiliation: reaf,
        fetchedAt: factual.fetchedAt
      }
    });

  } catch (error: any) {
    console.error('Error auditing product:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
