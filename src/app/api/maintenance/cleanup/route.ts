// src/app/api/maintenance/cleanup/route.ts
// Rotina de limpeza — remove send_jobs e send_receipts antigos para manter o banco leve.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// ─── Configuração ──────────────────────────────────────────────────────────
const RETENTION_DAYS_COMPLETED_JOBS = 7;   // Jobs completados: manter 7 dias
const RETENTION_DAYS_FAILED_JOBS = 14;     // Jobs falhados: manter 14 dias (para debug)
const RETENTION_DAYS_RECEIPTS = 30;        // Recibos: manter 30 dias (histórico de idempotência)

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export async function POST(request: Request) {
  try {
    // ─── Proteção por secret ───────────────────────────────────────────────
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient();
    const stats = {
      completed_jobs_deleted: 0,
      failed_jobs_deleted: 0,
      cancelled_jobs_deleted: 0,
      old_receipts_deleted: 0,
    };

    // ─── 1. Limpar jobs COMPLETADOS antigos ────────────────────────────────
    const { data: completedJobs } = await supabase
      .from('send_jobs')
      .delete()
      .eq('status', 'completed')
      .lt('processed_at', daysAgo(RETENTION_DAYS_COMPLETED_JOBS))
      .select('id');

    stats.completed_jobs_deleted = completedJobs?.length || 0;

    // ─── 2. Limpar jobs FALHADOS antigos ───────────────────────────────────
    const { data: failedJobs } = await supabase
      .from('send_jobs')
      .delete()
      .eq('status', 'failed')
      .lt('processed_at', daysAgo(RETENTION_DAYS_FAILED_JOBS))
      .select('id');

    stats.failed_jobs_deleted = failedJobs?.length || 0;

    // ─── 3. Limpar jobs CANCELADOS antigos ─────────────────────────────────
    const { data: cancelledJobs } = await supabase
      .from('send_jobs')
      .delete()
      .eq('status', 'cancelled')
      .lt('updated_at', daysAgo(RETENTION_DAYS_COMPLETED_JOBS))
      .select('id');

    stats.cancelled_jobs_deleted = cancelledJobs?.length || 0;

    // ─── 4. Limpar recibos antigos ─────────────────────────────────────────
    // Nota: só deleta recibos cujo send_job já foi removido ou que são muito antigos
    const { data: oldReceipts } = await supabase
      .from('send_receipts')
      .delete()
      .lt('created_at', daysAgo(RETENTION_DAYS_RECEIPTS))
      .select('id');

    stats.old_receipts_deleted = oldReceipts?.length || 0;

    const totalDeleted =
      stats.completed_jobs_deleted +
      stats.failed_jobs_deleted +
      stats.cancelled_jobs_deleted +
      stats.old_receipts_deleted;

    console.log(`[Cleanup] Removed ${totalDeleted} records`, stats);

    return NextResponse.json({
      success: true,
      cleaned_at: new Date().toISOString(),
      total_deleted: totalDeleted,
      stats
    });

  } catch (error: any) {
    console.error('Maintenance Cleanup Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
