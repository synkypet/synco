import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normalizeKeywords } from '@/lib/automation/keyword-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const sourceId = params.id;

  try {
    // 1. Buscar a fonte para metadados de status
    const { data: source, error: sourceError } = await supabase
      .from('automation_sources')
      .select('*, automation_routes(filters)')
      .eq('id', sourceId)
      .single();

    if (sourceError || !source) {
      return NextResponse.json({ error: 'Fonte não encontrada' }, { status: 404 });
    }

    // 2. Buscar os últimos 50 eventos do log de atividade
    const { data: logs, error: logsError } = await supabase
      .from('radar_activity_log')
      .select(`
        event_type,
        keyword,
        score,
        commission_value,
        discard_reason,
        created_at,
        metadata,
        campaign_id
      `)
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (logsError) throw logsError;

    // 3. Lógica de Status e Próxima Keyword
    const config = (source.config as any) || {};
    const keywords = normalizeKeywords(config);
    
    // Rotação: menor last_used_at (ou null)
    const sortedKeywords = [...keywords].sort((a, b) => {
      const tA = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
      const tB = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
      return tA - tB;
    });

    const nextKeyword = sortedKeywords[0]?.term || 'N/A';

    // Determinar Status
    const preset = config.preset_type || 'balanced';
    let cooldownMinutes = config.cooldown_minutes || 60;
    if (preset === 'aggressive') cooldownMinutes = 20;
    else if (preset === 'conservative') cooldownMinutes = 120;

    const lastRun = source.last_restock_at ? new Date(source.last_restock_at).getTime() : 0;
    const effectiveCooldownMin = source.needs_restock ? 1 : cooldownMinutes;
    const cooldownMs = effectiveCooldownMin * 60 * 1000;
    const isCooldown = (Date.now() - lastRun) < cooldownMs;

    let status: 'active' | 'cooldown' | 'awaiting_restock' = 'active';
    if (source.needs_restock) status = 'awaiting_restock';
    else if (isCooldown) status = 'cooldown';

    // 4. Formatar Eventos para a UI
    const formattedEvents = (logs || []).map(log => ({
      event_type: log.event_type,
      product_title: log.metadata?.title || 'Produto Desconhecido',
      keyword: log.keyword,
      score: log.score,
      commission_value: log.commission_value,
      discard_reason: log.discard_reason,
      created_at: log.created_at,
      campaign_id: log.campaign_id
    }));

    return NextResponse.json({
      status,
      next_keyword: nextKeyword,
      discovery_page: source.discovery_page || 1,
      last_run_at: source.last_restock_at,
      events: formattedEvents
    });

  } catch (error: any) {
    console.error('[API-RADAR-ACTIVITY] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
