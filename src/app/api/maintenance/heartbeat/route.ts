// src/app/api/maintenance/heartbeat/route.ts
// Heartbeat v2 — Hardened safety pump and stuck job recovery.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { triggerWorker } from '@/lib/worker/trigger';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const requestId = `heartbeat-${Math.random().toString(36).substring(7)}`;
  const supabase = createAdminClient();

  try {
    // 0. Autenticação (Proteção contra acesso público)
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;
    
    if (expectedSecret && cronSecret !== expectedSecret) {
      console.warn(`[HEARTBEAT-UNAUTHORIZED] [${requestId}] Tentativa de acesso sem secret válido.`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paramSource = searchParams.get('source');
    const validSource = (paramSource === 'cronjob' || paramSource === 'github' || paramSource === 'manual') 
      ? paramSource 
      : 'heartbeat';

    // 1. Lock de Manutenção (Previnir execuções paralelas do cron)
    const { data: hasLock } = await supabase.rpc('claim_maintenance_lock', {
      p_lock_key: 'queue_pump',
      p_worker_id: requestId,
      p_timeout_seconds: 55 
    });

    if (!hasLock) {
      return NextResponse.json({ 
        success: true, 
        message: 'Heartbeat skip: already locked', 
        requestId 
      });
    }

    // 2. Manutenção de Jobs Presos (Auto-Recovery)
    // Reseta jobs que ficaram travados em 'processing' por mais de 10 minutos
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recoveredData, error: recoveryError } = await supabase
      .from('send_jobs')
      .update({ 
        status: 'pending', 
        updated_at: new Date().toISOString(),
        last_error: 'Recovered to pending (processing stall > 10m)' 
      })
      .eq('status', 'processing')
      .lt('updated_at', tenMinutesAgo)
      .select('id');

    if (recoveryError) {
      console.error(`[HEARTBEAT] [${requestId}] Erro ao recuperar jobs:`, recoveryError);
    }
    const recoveredCount = recoveredData?.length || 0;

    if (recoveredCount > 0) {
      console.log(`[HEARTBEAT] [${requestId}] Recuperados ${recoveredCount} jobs estagnados.`);
    }

    // 3. Verificar se existem jobs pendentes
    const { count, error: countError } = await supabase
      .from('send_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (countError) throw countError;

    if (!count || count === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Queue idle: no pending jobs',
        recovered: recoveredCount || 0,
        requestId 
      });
    }

    // 4. Verificar estado do processamento atual
    const { data: activeJobs } = await supabase
      .from('send_jobs')
      .select('id, updated_at')
      .eq('status', 'processing')
      .order('updated_at', { ascending: true })
      .limit(1);

    const hasActiveWorker = activeJobs && activeJobs.length > 0;
    let shouldTrigger = !hasActiveWorker;

    if (hasActiveWorker) {
      const updatedAt = new Date(activeJobs[0].updated_at).getTime();
      const diffMs = Date.now() - updatedAt;
      
      // Se o job ativo estiver parado há mais de 3 minutos e não foi pego pelo recovery de 10m,
      // re-disparamos o worker para garantir que o fluxo não parou.
      if (diffMs > 180000) { 
        console.log(`[HEARTBEAT] [${requestId}] Detectada lentidão no worker (${diffMs}ms). Forçando re-trigger.`);
        shouldTrigger = true;
      }
    }

    if (shouldTrigger) {
      console.log(`[HEARTBEAT] [${requestId}] Bombeando fila: ${count} jobs pendentes.`);
      const host = request.headers.get('host') || undefined;
      
      // Aciona o worker em background (NON-BLOCKING)
      // triggerWorker agora usa waitUntil internamente para garantir execução em serverless
      triggerWorker({ 
        requestId, 
        host,
        shouldAwait: false,
        source: validSource as any
      });
      
      return NextResponse.json({ 
        success: true, 
        message: 'Worker trigger initiated (heartbeat pump)', 
        pendingCount: count,
        recovered: recoveredCount || 0,
        requestId 
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Queue flowing: worker is active', 
      recovered: recoveredCount || 0,
      requestId 
    });

  } catch (error: any) {
    console.error(`[HEARTBEAT-ERROR] [${requestId}]`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
