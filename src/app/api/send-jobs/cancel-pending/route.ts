// src/app/api/send-jobs/cancel-pending/route.ts
// Cancela apenas os jobs `pending` de uma campanha específica.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PATCH(request: Request) {
  try {
    const { campaign_id } = await request.json();

    if (!campaign_id) {
      return NextResponse.json({ error: 'Missing campaign_id' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('send_jobs')
      .update({
        status: 'cancelled',
        last_error: 'Cancelado manualmente pelo usuário',
        updated_at: new Date().toISOString()
      })
      .eq('campaign_id', campaign_id)
      .eq('status', 'pending')
      .select('id');

    if (error) throw error;

    console.log(`[CANCEL-PENDING] Campanha ${campaign_id}: ${data?.length || 0} jobs cancelados.`);

    return NextResponse.json({ cancelled: data?.length || 0 });

  } catch (error: any) {
    console.error('[CANCEL-PENDING] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
