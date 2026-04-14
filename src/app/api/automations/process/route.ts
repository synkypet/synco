// src/app/api/automations/process/route.ts
import { NextResponse } from 'next/server';
import { processInboundAutomation } from '@/lib/automation/processor';
import { triggerWorker } from '@/lib/worker/trigger';

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(7);
  try {
    const payload = await request.json();
    console.log(`[PROCESS-ROUTE] [${requestId}] Payload recebido:`, JSON.stringify(payload, null, 2));
    
    const result = await processInboundAutomation(payload);
    
    console.log(`[PROCESS-ROUTE] [${requestId}] Resultado do processamento:`, JSON.stringify(result, null, 2));

    // ─── Fast-Trigger: Disparar o worker imediatamente para reduzir a latência ──────
    if (!result.skipped) {
      const protocol = request.url.startsWith('https') ? 'https' : 'http';
      const host = request.headers.get('host');
      const baseUrl = `${protocol}://${host}`;
      
      // Utilizar o novo utilitário compartilhado
      await triggerWorker({ 
        requestId, 
        baseUrl 
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`[PROCESS-ROUTE] [${requestId}] ERRO CRÍTICO:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
