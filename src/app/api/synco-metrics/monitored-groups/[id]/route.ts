import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canUseSyncoMetrics } from '@/lib/synco-metrics';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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
    
    // Filtro estrito de campos permitidos (evita que backend receba injeção de campos operacionais)
    const allowedUpdates: any = {};
    if (typeof body.enabled === 'boolean') allowedUpdates.enabled = body.enabled;
    if (typeof body.monitor_interval_minutes === 'number') allowedUpdates.monitor_interval_minutes = body.monitor_interval_minutes;
    if (typeof body.is_deleted === 'boolean') allowedUpdates.is_deleted = body.is_deleted;

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo válido para atualização' }, { status: 400 });
    }

    // A trigger do banco já protege campos operacionais e o RLS barra outros users.
    // Mas validamos a atualização estrita.
    const { data: updated, error } = await supabase
      .from('sm_monitored_groups')
      .update(allowedUpdates)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, data: updated });

  } catch (error: any) {
    console.error('[SYNCOMETRICS-PATCH]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
