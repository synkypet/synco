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
    // 1. Verificar se existem jobs pendentes
    const { count, error: countError } = await supabase
      .from('send_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (countError) throw countError;

    if (!count || count === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Queue is empty', 
        requestId 
      });
    }

    // 2. Verificar se existe algum job em "processing" (indicativo de worker ativo)
    // Nota: Buscamos o job processando mais antigo (updated_at ASC) para detectar
    // de forma determinística se a fila está estagnada.
    const { data: activeJobs } = await supabase
      .from('send_jobs')
      .select('id, updated_at')
      .eq('status', 'processing')
      .order('updated_at', { ascending: true })
      .limit(1);

    const hasActiveWorker = activeJobs && activeJobs.length > 0;

    // Se não houver ninguém processando, ou se o job ativo estiver lá há mais de 2 minutos
    // (provável queda de worker), reiniciamos a corrente.
    let shouldTrigger = !hasActiveWorker;

    if (hasActiveWorker) {
      const updatedAt = new Date(activeJobs[0].updated_at).getTime();
      const diffMs = Date.now() - updatedAt;
      if (diffMs > 120000) { // 2 minutos
        console.log(`[HEARTBEAT] [${requestId}] Detectado job "processing" antigo (${diffMs}ms). Forçando trigger.`);
        shouldTrigger = true;
      }
    }

    if (shouldTrigger) {
      console.log(`[HEARTBEAT] [${requestId}] Acionando worker de recuperação para ${count} jobs pendentes.`);
      const host = request.headers.get('host') || undefined;
      await triggerWorker({ 
        requestId, 
        host,
        shouldAwait: true // Espera o trigger ser aceito para garantir que a corrente reiniciou
      });
      
      return NextResponse.json({ 
        success: true, 
        message: 'Worker triggered', 
        pendingCount: count,
        requestId 
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Worker seems active, skip trigger', 
      requestId 
    });

  } catch (error: any) {
    console.error(`[HEARTBEAT-ERROR] [${requestId}]`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
