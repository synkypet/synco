import { createClient } from '@/lib/supabase/server';
import { automationService } from '@/services/supabase/automation-service';
import { NextResponse } from 'next/server';
import { requireOperationalAccess } from '@/lib/access/require-operational-access';

/**
 * DELETE /api/automations/[id]
 * Remove uma fonte de automação e suas rotas vinculadas
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const logPrefix = `[AUTOMATION-DELETE] [${id}] [${new Date().toISOString()}]`;
  const gate = await requireOperationalAccess();
  if (!gate.ok) return gate.response;
  const { user } = gate;
  const supabase = createClient();

  try {
    // 1. Verificar se a automação pertence ao usuário
    const source = await automationService.getById(id, supabase);
    
    if (!source) {
      return NextResponse.json({ error: 'Automação não encontrada' }, { status: 404 });
    }

    if (source.user_id !== user.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // 2. Executar remoção
    console.log(`${logPrefix} Removendo automação e dependências...`);
    await automationService.deleteSource(id, supabase);

    return NextResponse.json({ success: true, message: 'Automação excluída com sucesso' });

  } catch (error: any) {
    console.error(`${logPrefix} Erro na exclusão:`, error.message);
    return NextResponse.json({ 
      error: 'Erro interno ao excluir automação', 
      details: error.message 
    }, { status: 500 });
  }
}
