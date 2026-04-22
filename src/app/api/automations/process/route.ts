// src/app/api/automations/process/route.ts
import { NextResponse } from 'next/server';
import { processInboundAutomation } from '@/lib/automation/processor';
import { triggerWorker } from '@/lib/worker/trigger';

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(7);
  try {
    const payload = await request.json();
    const { userId } = payload;
    console.log(`[PROCESS-ROUTE] [${requestId}] Payload recebido para user ${userId}:`, JSON.stringify(payload, null, 2));

    // ─── BILLING ENFORCEMENT (Fase 2) ──────────────────────────────────────────
    if (userId) {
      const { resolveUserAccess } = await import('@/services/supabase/access-service');
      const access = await resolveUserAccess(userId);

      if (!access.isOperative) {
        console.warn(`[PROCESS-ROUTE] [${requestId}] Acesso negado para user ${userId}. Status: ${access.status}`);
        return NextResponse.json({ 
          error: 'Acesso Operacional Restrito', 
          code: 'BILLING_RESTRICTED',
          accessResolution: access.status,
          message: 'Seu plano atual ou status de pagamento não permite realizar novos disparos automáticos.'
        }, { status: 403 });
      }
    }
    
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
