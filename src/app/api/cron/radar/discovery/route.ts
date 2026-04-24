// src/app/api/cron/radar/discovery/route.ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ShopeeAdapter } from '@/lib/marketplaces/ShopeeAdapter';
import { productService } from '@/services/supabase/product-service';
import { automationService } from '@/services/supabase/automation-service';
import { radarDiscoveryService } from '@/services/radar-discovery-service';

export const dynamic = 'force-dynamic';

/**
 * Radar Discovery Engine (Ingestion)
 * Busca ofertas baseadas em Filtros de Usuário (Radar Pro) + Descoberta Global.
 */
export async function GET(request: Request) {
  const cronSecret = request.headers.get('x-cron-secret');
  const expectedSecret = process.env.CRON_SECRET;
  
  if (process.env.NODE_ENV === 'production' && expectedSecret && cronSecret !== expectedSecret) {
    console.warn(`[RADAR-DISCOVERY-UNAUTHORIZED] Tentativa de acesso sem secret válido.`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requestId = Math.random().toString(36).substring(7);
  const logPrefix = `[RADAR-DISCOVERY] [${requestId}]`;
  
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === '1';
    if (force) console.log(`${logPrefix} [FORCE-DISCOVERY] Ignorando cooldowns por comando manual.`);
    const supabase = createAdminClient();
    const result = await radarDiscoveryService.executeDiscovery(supabase, { force });

    console.log(`${logPrefix} Ciclo finalizado. Inseridos: ${result.totalInserted}`);
    
    return NextResponse.json({
      status: 'success',
      upserted: result.totalInserted,
      tasks: result.tasksExecuted
    });

  } catch (error: any) {
    console.error(`${logPrefix} ERRO NO MOTOR DE DESCOBERTA:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
