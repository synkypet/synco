import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { shopeeCouponService } from '@/services/supabase/shopee-coupon-service';

/**
 * PATCH /api/shopee/discovered-coupons/[id]
 * Ação: rejeitar/remover um cupom capturado.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'ID do cupom é obrigatório' }, { status: 400 });
    }

    const { action } = await req.json();

    if (action === 'reject') {
      const supabaseAdmin = createAdminClient();
      await shopeeCouponService.rejectCandidates(user.id, [id], supabaseAdmin);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });

  } catch (error: any) {
    console.error('[API-DISCOVERED-COUPONS-PATCH] Erro ao processar ação:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar ação' },
      { status: 500 }
    );
  }
}
