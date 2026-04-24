// src/app/api/cron/radar/dispatcher/route.ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { radarDispatcherService } from '@/services/radar-dispatcher-service';

export const dynamic = 'force-dynamic';

/**
 * Radar Dispatcher Engine (Automation)
 * Cruza produtos descobertos com as regras de automação dos usuários.
 */
export async function GET(request: Request) {
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;
  
  if (process.env.NODE_ENV === 'production' && expectedSecret && cronSecret !== expectedSecret) {
    console.warn(`[RADAR-DISPATCHER-UNAUTHORIZED] Tentativa de acesso sem secret válido.`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requestId = Math.random().toString(36).substring(7);
  const logPrefix = `[RADAR-DISPATCHER] [${requestId}]`;
  
  try {
    const supabase = createAdminClient();
    const result = await radarDispatcherService.executeDispatch(supabase, { requestId });

    return NextResponse.json({
      status: 'success',
      campaigns_created: result.campaignsCreated
    });

  } catch (error: any) {
    console.error(`${logPrefix} ERRO CRÍTICO NO DISPATCHER:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
