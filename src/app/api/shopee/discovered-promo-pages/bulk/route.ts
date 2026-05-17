import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/shopee/discovered-promo-pages/bulk
 * Ação: Operações em lote (ex: rejeitar múltiplas páginas de ofertas).
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
      const adminClient = createAdminClient();

      // 1. Remover primeiro as regras de automação vinculadas
      const { error: rulesError } = await adminClient
        .from('automation_coupon_rules')
        .delete()
        .eq('user_id', user.id)
        .in('promo_page_id', ids);

      if (rulesError) {
        console.error('[BULK-DELETE-PROMO] Erro ao remover regras vinculadas:', rulesError);
        return NextResponse.json({ error: 'Falha ao remover regras de automação vinculadas.' }, { status: 500 });
      }

      // 2. Remover as páginas promocionais
      const { error: deleteError } = await adminClient
        .from('discovered_promo_pages')
        .delete()
        .eq('user_id', user.id)
        .in('id', ids);

      if (deleteError) {
        throw deleteError;
      }

      return NextResponse.json({ success: true, count: ids.length });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });

  } catch (error: any) {
    console.error('[API-DISCOVERED-PROMO-BULK] Erro ao processar ação em lote:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno ao processar ação em lote' },
      { status: 500 }
    );
  }
}
