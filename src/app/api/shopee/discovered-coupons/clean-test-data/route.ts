import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/access/require-operational-access';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/shopee/discovered-coupons/clean-test-data[?onlyCount=1]
 *
 * SOFT DELETE controlado para limpar dados de teste.
 *
 * Com ?onlyCount=1: retorna quantos registros seriam afetados, SEM ALTERAR nada.
 * Sem query param: executa o soft delete (requer confirmação na UI).
 *
 * Comportamento:
 * - Afeta APENAS os registros do usuário autenticado (user_id = auth.uid)
 * - Usa adminClient para bypassar RLS, mas filtra explicitamente por user_id
 * - NÃO faz hard delete. Altera: validation_status='rejected', is_verified_coupon=false
 * - Depende de validation_status e is_verified_coupon existirem (migration 20260515213000)
 * - Se as colunas não existirem, retorna erro claro
 * - NÃO altera automation_coupon_rules (mantém regras de automação intactas)
 * - NÃO altera dispatchable nem auto_dispatch_blocked
 */
export async function POST(request: Request) {
  const gate = await requireAuthenticatedUser();
  if (!gate.ok) return gate.response;
  const { user } = gate;

  const adminClient = createAdminClient();
  const { searchParams } = new URL(request.url);
  const onlyCount = searchParams.has('onlyCount');

  try {
    // 1. Contar quantos registros do USUÁRIO ATUAL seriam afetados
    const { count: totalCount, error: countError } = await adminClient
      .from('discovered_coupons')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)                 // ← Apenas meu usuário
      .neq('validation_status', 'rejected');  // ← Apenas os ainda não ocultados

    if (countError) {
      // Se a coluna validation_status não existir, informar claramente
      if (countError.message?.includes('column') || countError.code === '42703') {
        return NextResponse.json({
          error: 'Coluna validation_status não existe no banco. Aplique a migration 20260515213000_add_validation_status_to_discovered_coupons.sql antes de usar este recurso.',
          migration_required: '20260515213000_add_validation_status_to_discovered_coupons.sql'
        }, { status: 422 });
      }
      throw countError;
    }

    const affected = totalCount ?? 0;

    // 2. Se apenas contagem, retorna preview sem executar
    if (onlyCount) {
      return NextResponse.json({
        would_affect: affected,
        is_soft_delete: true,
        affects_only_my_user: true,
        affects_automations: false,  // automation_coupon_rules NÃO são alteradas
        hard_delete: false,
        columns_changed: ['validation_status → rejected', 'is_verified_coupon → false'],
        preserved: ['code', 'redemption_url', 'dispatchable', 'auto_dispatch_blocked', 'capture_count', 'raw_text'],
        message: `Soft delete afetaria ${affected} registro(s) do seu usuário. Nenhuma automação seria alterada.`
      });
    }

    // 3. Executar soft delete apenas para o usuário atual
    const { error: updateError } = await adminClient
      .from('discovered_coupons')
      .update({
        validation_status: 'rejected',
        is_verified_coupon: false
      })
      .eq('user_id', user.id)
      .neq('validation_status', 'rejected');

    if (updateError) {
      throw updateError;
    }

    console.log(`[CLEAN-TEST-DATA] user=${user.id} soft-deleted ${affected} coupons`);

    return NextResponse.json({
      success: true,
      affected,
      is_soft_delete: true,
      affects_only_my_user: true,
      affects_automations: false,
      message: `${affected} registro(s) ocultados com soft delete. Histórico e automações preservados.`
    });

  } catch (error: any) {
    console.error('[CLEAN-TEST-DATA] Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
