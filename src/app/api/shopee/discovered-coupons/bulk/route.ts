import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { shopeeCouponService } from '@/services/supabase/shopee-coupon-service';

/**
 * POST /api/shopee/discovered-coupons/bulk
 * Ação: Operações em lote (ex: rejeitar múltiplos cupons).
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { ids, action } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Lista de IDs inválida' }, { status: 400 });
    }

    if (action === 'reject') {
      const supabaseAdmin = createAdminClient();
      await shopeeCouponService.rejectCandidates(user.id, ids, supabaseAdmin);
      return NextResponse.json({ success: true, count: ids.length });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });

  } catch (error: any) {
    console.error('[API-DISCOVERED-COUPONS-BULK] Erro ao processar ação em lote:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar ação em lote' },
      { status: 500 }
    );
  }
}
