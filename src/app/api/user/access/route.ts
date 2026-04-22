import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveUserAccess } from '@/services/supabase/access-service';

/**
 * Rota Oficial de Consulta de Acesso e Billing.
 * Consumida pelo hook useAccess para gerenciar visibilidade de recursos e limites na UI.
 */
export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Chama o resolvedor central (Single Source of Truth)
    const access = await resolveUserAccess(user.id);

    // Adiciona o userId para conveniência do frontend
    return NextResponse.json({
      ...access,
      userId: user.id
    });

  } catch (error: any) {
    console.error('[API-USER-ACCESS] Erro fatal:', error);
    return NextResponse.json({ 
      error: 'Erro ao processar resolução de acesso',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}
