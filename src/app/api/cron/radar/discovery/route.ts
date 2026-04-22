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
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requestId = Math.random().toString(36).substring(7);
  const logPrefix = `[RADAR-DISCOVERY] [${requestId}]`;
  console.log(`${logPrefix} Iniciando ciclo de descoberta autônoma...`);

  try {
    const supabase = createAdminClient();
    const result = await radarDiscoveryService.executeDiscovery(supabase);

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
