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
    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`[PROCESS-ROUTE] [${requestId}] ERRO CRÍTICO:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
