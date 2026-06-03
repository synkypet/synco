import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canUseSyncoMetrics, SYNCO_METRICS_LIMIT } from '@/lib/synco-metrics';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasAccess = await canUseSyncoMetrics(user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Plano não permite uso do SyncoMetrics' }, { status: 403 });
    }

    const body = await request.json();
    const { group_id, channel_id } = body;

    if (!group_id || !channel_id) {
      return NextResponse.json({ error: 'group_id e channel_id são obrigatórios' }, { status: 400 });
    }

    // 1. Validar ownership do canal e grupo na API (além do banco)
    const { data: groupCheck } = await supabase
      .from('groups')
      .select('id, channel_id')
      .eq('id', group_id)
      .eq('user_id', user.id)
      .eq('channel_id', channel_id)
      .single();

    if (!groupCheck) {
      return NextResponse.json({ error: 'Grupo não encontrado ou não pertence ao usuário' }, { status: 404 });
    }

    // 2. Checar limite de 3 ativos
    const { count: activeCount } = await supabase
      .from('sm_monitored_groups')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('enabled', true)
      .eq('is_deleted', false);

    if ((activeCount || 0) >= SYNCO_METRICS_LIMIT) {
      return NextResponse.json({ error: `Limite máximo de ${SYNCO_METRICS_LIMIT} atingido` }, { status: 403 });
    }

    // 3. Checar se já existe registro (soft delete ou apenas desativado)
    const { data: existing } = await supabase
      .from('sm_monitored_groups')
      .select('id, is_deleted')
      .eq('user_id', user.id)
      .eq('group_id', group_id)
      .eq('is_deleted', false)
      .maybeSingle();

    if (existing) {
      // Já existe, apenas ativamos (reativação)
      const { data: updated, error: updateErr } = await supabase
        .from('sm_monitored_groups')
        .update({ enabled: true })
        .eq('id', existing.id)
        .select()
        .single();
      
      if (updateErr) throw updateErr;
      return NextResponse.json({ success: true, data: updated });
    }

    // 4. Criação de novo
    const { data: inserted, error: insertErr } = await supabase
      .from('sm_monitored_groups')
      .insert({
        user_id: user.id,
        group_id: group_id,
        channel_id: channel_id,
        enabled: true
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return NextResponse.json({ success: true, data: inserted });

  } catch (error: any) {
    console.error('[SYNCOMETRICS-POST]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
