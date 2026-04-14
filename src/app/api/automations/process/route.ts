// src/app/api/automations/process/route.ts
import { NextResponse } from 'next/server';
import { processInboundAutomation } from '@/lib/automation/processor';

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
      const workerUrl = `${baseUrl}/api/send-jobs/process`;

      console.log(`[PROCESS-ROUTE] [${requestId}] [FAST-TRIGGER] Acionando worker em ${workerUrl}...`);

      // Disparo assíncrono (Fire and Forget) com propagação de requestId
      // Adicionamos timeout curto na conexão mas não aguardamos a resposta completa do processamento
      fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': process.env.CRON_SECRET || '',
          'x-request-id': requestId
        }
      }).catch(err => {
        console.error(`[PROCESS-ROUTE] [${requestId}] [FAST-TRIGGER-ERROR] Falha ao acionar worker:`, err);
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`[PROCESS-ROUTE] [${requestId}] ERRO CRÍTICO:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
