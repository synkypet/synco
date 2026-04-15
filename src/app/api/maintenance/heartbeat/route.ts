// src/app/api/maintenance/heartbeat/route.ts
// Heartbeat v1 — Rede de segurança para garantir drenagem da fila.
// Deve ser acionado via Cron (ex: cada 1 ou 2 minutos).
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { triggerWorker } from '@/lib/worker/trigger';

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
    // 1. Lock de Manutenção (Previnir execuções paralelas do cron)
    const { data: hasLock } = await supabase.rpc('claim_maintenance_lock', {
      p_lock_key: 'queue_pump',
      p_worker_id: requestId,
      p_timeout_seconds: 55 // Expira pouco antes do próximo ciclo de 1min
    });

    if (!hasLock) {
      return NextResponse.json({ 
        success: true, 
        message: 'Heartbeat skip: already locked by another process', 
        requestId 
      });
    }

    // 2. Verificar se existem jobs pendentes
    const { count, error: countError } = await supabase
      .from('send_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (countError) throw countError;

    if (!count || count === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Queue idle: no pending jobs', 
        requestId 
      });
    }

    // 3. Verificar estado do processamento atual
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
      
      // Se o job ativo estiver parado há mais de 2.5 minutos, consideramos worker morto
      if (diffMs > 150000) { 
        console.log(`[HEARTBEAT] [${requestId}] Detectada estagnação (${diffMs}ms). Reativando drenagem.`);
        shouldTrigger = true;
      }
    }

    if (shouldTrigger) {
      console.log(`[HEARTBEAT] [${requestId}] Bombeando fila: ${count} jobs pendentes.`);
      const host = request.headers.get('host') || undefined;
      
      // Aciona o worker. Usamos shouldAwait: true no heartbeat para confirmar que o pump começou.
      const triggered = await triggerWorker({ 
        requestId, 
        host,
        shouldAwait: true 
      });
      
      return NextResponse.json({ 
        success: true, 
        message: triggered ? 'Worker re-activated' : 'Worker trigger failed', 
        pendingCount: count,
        requestId 
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Queue flowing: worker is active', 
      requestId 
    });

  } catch (error: any) {
    console.error(`[HEARTBEAT-ERROR] [${requestId}]`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
