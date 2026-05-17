import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/access/require-operational-access';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * DELETE /api/shopee/discovered-promo-pages/[id]
 * Remove uma página de promoção capturada do usuário.
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const gate = await requireAuthenticatedUser();
  if (!gate.ok) return gate.response;
  const { user } = gate;
  const adminClient = createAdminClient();
  const { id } = params;

  try {
    // 1. Verificar ownership e existência da página
    const { data: page, error: fetchError } = await adminClient
      .from('discovered_promo_pages')
      .select('id, user_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !page) {
      return NextResponse.json({ error: 'Página promocional não encontrada ou não pertence ao usuário.' }, { status: 404 });
    }

    // 2. Remover regras de automação vinculadas para evitar quebra de FK
    const { error: rulesError } = await adminClient
      .from('automation_coupon_rules')
      .delete()
      .eq('user_id', user.id)
      .eq('promo_page_id', id);

    if (rulesError) {
      console.error('[DELETE-PROMO-PAGE] Erro ao remover regras vinculadas:', rulesError);
      return NextResponse.json({ error: 'Falha ao remover regras de automação vinculadas.' }, { status: 500 });
    }

    // 3. Remover a página promocional (Hard Delete)
    const { error: deleteError } = await adminClient
      .from('discovered_promo_pages')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true, message: 'Página promocional removida com sucesso.' });

  } catch (error: any) {
    console.error('[DELETE-PROMO-PAGE] Erro crítico:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/shopee/discovered-promo-pages/[id]
 * Atualiza o título/label de uma página de promoção capturada.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const gate = await requireAuthenticatedUser();
  if (!gate.ok) return gate.response;
  const { user } = gate;
  const adminClient = createAdminClient();
  const { id } = params;

  try {
    const body = await request.json();
    const newTitle = body.title ?? body.coupon_label ?? body.label ?? body.display_name;

    if (newTitle === undefined) {
      return NextResponse.json({ error: 'Nenhum campo de edição válido fornecido.' }, { status: 400 });
    }

    // 1. Verificar ownership e existência da página
    const { data: page, error: fetchError } = await adminClient
      .from('discovered_promo_pages')
      .select('id, user_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !page) {
      return NextResponse.json({ error: 'Página promocional não encontrada ou não pertence ao usuário.' }, { status: 404 });
    }

    // 2. Atualizar o título
    const { data: updatedPage, error: updateError } = await adminClient
      .from('discovered_promo_pages')
      .update({
        title: newTitle,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true, page: updatedPage });

  } catch (error: any) {
    console.error('[PATCH-PROMO-PAGE] Erro crítico:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
