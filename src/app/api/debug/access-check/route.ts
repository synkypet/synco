import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveUserAccess } from '@/services/supabase/access-service';

/**
 * Endpoint de Debug para Validação de Billing e Access Control.
 * Disponível apenas em ambiente de desenvolvimento.
 */
export async function GET() {
  // Segurança: Bloquear em produção
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Chama o resolvedor central (Fase 1/2)
    const access = await resolveUserAccess(user.id);

    return NextResponse.json({
      user_id: user.id,
      accessResolution: access.status,
      hasAccess: access.status !== 'expired_blocked' && access.status !== 'no_subscription',
      isOperative: access.isOperative,
      plan: access.planName || 'Nenhum / Especial',
      quotas: access.quotas,
      features: access.features
    });

  } catch (error: any) {
    console.error('[DEBUG-ACCESS-CHECK] Erro:', error);
    return NextResponse.json({ 
      error: 'Erro ao processar resolução de acesso',
      details: error.message 
    }, { status: 500 });
  }
}
