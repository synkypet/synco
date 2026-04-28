// src/app/api/automations/process/route.ts
import { NextResponse } from 'next/server';
import { processInboundAutomation } from '@/lib/automation/processor';
import { triggerWorker } from '@/lib/worker/trigger';
import { requireOperationalAccess } from '@/lib/access/require-operational-access';

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(7);
  try {
    const payload = await request.json();
    const { userId } = payload;
    console.log(`[PROCESS-ROUTE] [${requestId}] Payload recebido para user ${userId}:`, JSON.stringify(payload, null, 2));

    const gate = await requireOperationalAccess();
    if (!gate.ok) return gate.response;
    const { user, access } = gate;

    // Overwrite any forged userId carefully in payload
    payload.userId = user.id;
    
    const result = await processInboundAutomation(payload);
    
    console.log(`[PROCESS-ROUTE] [${requestId}] Resultado do processamento:`, JSON.stringify(result, null, 2));

    // ─── Fast-Trigger: Disparar o worker imediatamente para reduzir a latência ──────
    if (!result.skipped) {
      // Utilizar o novo utilitário compartilhado que resolve a URL base por ambiente
      await triggerWorker({ 
        requestId 
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`[PROCESS-ROUTE] [${requestId}] ERRO CRÍTICO:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
