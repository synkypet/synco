import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/access/require-operational-access';
import { shopeeCouponService } from '@/services/supabase/shopee-coupon-service';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/shopee/discovered-coupons
 * Lista cupons Shopee detectados para o usuário autenticado.
 */
export async function GET(request: Request) {
  try {
    // 1. Validar usuário autenticado (Gate de Segurança)
    const gate = await requireAuthenticatedUser();
    if (!gate.ok) return gate.response;
    const { user } = gate;

    // 2. Extrair parâmetros de busca da URL
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const couponType = searchParams.get('coupon_type') || undefined;
    const search = searchParams.get('search') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : 50;

    // 3. Validações de domínio para os parâmetros
    if (status && !['candidate', 'unknown', 'valid', 'expired'].includes(status)) {
       return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
    }

    if (couponType && !['codigo', 'link_resgate', 'pagina_cupons'].includes(couponType)) {
       return NextResponse.json({ error: 'Tipo de cupom inválido' }, { status: 400 });
    }

    // 4. Executar listagem via serviço
    // O serviço utiliza createAdminClient para bypass de RLS se necessário, 
    // mas o filtro por user_id é injetado programaticamente e obrigatório.
    const supabaseAdmin = createAdminClient();
    const coupons = await shopeeCouponService.listDiscoveredCoupons(user.id, {
      status,
      couponType,
      search,
      limit
    }, supabaseAdmin);

    // 5. Retornar resposta formatada
    // Nota: O serviço retorna apenas os campos necessários mapeados no select('*')
    return NextResponse.json({
      status: 'SUCCESS',
      count: coupons.length,
      data: coupons
    });

  } catch (error: any) {
    console.error('[API-DISCOVERED-COUPONS] Erro crítico:', error.message);
    return NextResponse.json(
      { error: 'Falha interna ao processar listagem de cupons.' }, 
      { status: 500 }
    );
  }
}
