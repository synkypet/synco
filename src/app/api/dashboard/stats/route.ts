// src/app/api/dashboard/stats/route.ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient();

    // Extrair user_id do header (enviado pelo frontend via AuthContext)
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Total de mensagens enviadas com sucesso
    const { count: totalSent } = await supabase
      .from('send_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed');

    // 2. Total de erros de envio
    const { count: totalErrors } = await supabase
      .from('send_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'failed');

    // 3. Total de produtos no Radar
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // 4. Total de grupos sincronizados
    const { count: totalGroups } = await supabase
      .from('groups')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // 5. Score médio dos produtos
    const { data: scoreData } = await supabase
      .from('products')
      .select('opportunity_score')
      .eq('user_id', userId)
      .not('opportunity_score', 'is', null);

    const avgScore = scoreData && scoreData.length > 0
      ? scoreData.reduce((acc, p) => acc + (p.opportunity_score || 0), 0) / scoreData.length
      : 0;

    // 6. Últimas 20 campanhas
    const { data: recentCampaigns } = await supabase
      .from('campaigns')
      .select(`
        id,
        name,
        status,
        created_at,
        total_destinations
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    // 7. Jobs pendentes (na fila)
    const { count: totalPending } = await supabase
      .from('send_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending');

    return NextResponse.json({
      totalSent: totalSent || 0,
      totalErrors: totalErrors || 0,
      totalPending: totalPending || 0,
      totalProducts: totalProducts || 0,
      totalGroups: totalGroups || 0,
      avgScore: parseFloat(avgScore.toFixed(1)),
      recentCampaigns: recentCampaigns || [],
    });

  } catch (error: any) {
    console.error('[DASHBOARD-STATS] Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
