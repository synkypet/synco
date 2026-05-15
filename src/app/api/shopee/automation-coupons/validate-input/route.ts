import { NextResponse } from 'next/server';
import { requireOperationalAccess } from '@/lib/access/require-operational-access';
import { processLinks } from '@/lib/linkProcessor';
import { createAdminClient } from '@/lib/supabase/admin';
import { marketplaceService } from '@/services/supabase/marketplace-service';

export async function POST(request: Request) {
  try {
    // 1. Gate de Operações & Auth
    const gate = await requireOperationalAccess();
    if (!gate.ok) return gate.response;
    const { user } = gate;

    const { input } = await request.json();
    if (!input || typeof input !== 'string') {
      return NextResponse.json({ error: 'Input válido é obrigatório' }, { status: 400 });
    }

    // 2. Obter conexões do usuário para afiliação segura
    const supabaseAdmin = createAdminClient();
    const connections = await marketplaceService.getEnrichedConnections(user.id, supabaseAdmin);
    
    // 3. Processamento via linkProcessor (Factual + Afiliação + Classificação)
    // Passamos o input como sourceText para o extrator de cupons funcionar corretamente
    const snapshots = await processLinks([input], connections, 'auto', user.id, supabaseAdmin, input);
    
    if (snapshots.length === 0) {
      return NextResponse.json({ status: 'invalid', preview: null });
    }

    const snapshot = snapshots[0];
    const { factual, copy } = snapshot;
    const offerType = factual.eligibility.offer_type;

    // 4. Classificação final para a UI de Automação de Cupons
    let status: 'coupon' | 'promo_landing' | 'invalid' = 'invalid';
    
    if (offerType === 'coupon_offer' || offerType === 'product_with_coupon') {
      status = 'coupon';
    } else if (offerType === 'promo_landing') {
      status = 'promo_landing';
    } else {
      // Se for apenas um produto comum, consideramos inválido para este fluxo de cupons
      status = 'invalid';
    }

    // 5. Retorno de preview seguro
    return NextResponse.json({
      status,
      preview: {
        title: factual.title,
        image: factual.image,
        priceFormatted: factual.priceFormatted,
        discountPercent: factual.discountPercent,
        coupons: factual.coupons || [],
        messagePreview: copy.messageText,
        finalLink: factual.finalLinkToSend,
        offerType,
        marketplace: factual.marketplace,
        eligibility: factual.eligibility
      }
    });

  } catch (error: any) {
    console.error('[SHOPEE-COUPON-VALIDATE] Error:', error.message);
    return NextResponse.json({ error: 'Erro interno ao validar input' }, { status: 500 });
  }
}
