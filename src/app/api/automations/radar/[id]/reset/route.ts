import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { automationService } from '@/services/supabase/automation-service';
import { NextResponse } from 'next/server';
import { requireOperationalAccess } from '@/lib/access/require-operational-access';

/**
 * POST /api/automations/radar/[id]/reset
 * Reseta o cursor de busca, contadores e histórico de disparos de um Radar
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const logPrefix = `[RADAR-MANUAL-RESET] [${id}] [${new Date().toISOString()}]`;
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

    // 2. Garantir que a automação é do tipo radar_offers
    if (source.source_type !== 'radar_offers') {
      return NextResponse.json({ 
        error: 'Esta operação é permitida apenas para automações do tipo Radar de Ofertas.' 
      }, { status: 400 });
    }

    console.log(`${logPrefix} Resetando estado do Radar no banco...`);
    
    // 3. Resetar estado na tabela automation_sources
    const { error: updateError } = await supabase
      .from('automation_sources')
      .update({
        discovery_page: 1,
        consecutive_empty_cycles: 0,
        needs_restock: false,
        discovery_locked_until: null,
        discovery_exhausted_at: null
      })
      .eq('id', id);

    if (updateError) {
      throw new Error(`Erro ao atualizar estado da automação: ${updateError.message}`);
    }

    // 4. Limpar histórico de produtos descobertos (anti-fadiga e dispatch queue) com service role para contornar RLS
    console.log(`${logPrefix} Removendo registros da tabela radar_discovered_products...`);
    const supabaseAdmin = createAdminClient();
    const { error: deleteError } = await supabaseAdmin
      .from('radar_discovered_products')
      .delete()
      .eq('source_id', id);

    if (deleteError) {
      throw new Error(`Erro ao limpar produtos vinculados: ${deleteError.message}`);
    }

    console.log(`${logPrefix} Radar resetado com sucesso!`);
    return NextResponse.json({ 
      success: true, 
      message: 'Radar de Ofertas resetado com sucesso. A coleta de ofertas reiniciará a partir da página 1.' 
    });

  } catch (error: any) {
    console.error(`${logPrefix} Falha ao resetar radar:`, error.message);
    return NextResponse.json({ 
      error: 'Erro interno ao resetar o radar', 
      details: error.message 
    }, { status: 500 });
  }
}
