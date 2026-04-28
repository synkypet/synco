import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { radarDiscoveryService } from '@/services/radar-discovery-service';
import { requireOperationalAccess } from '@/lib/access/require-operational-access';

export async function POST(request: Request) {
  try {
    const { sourceId } = await request.json();

    if (!sourceId) {
      return NextResponse.json({ error: 'Source ID is required' }, { status: 400 });
    }

    const gate = await requireOperationalAccess();
    if (!gate.ok) return gate.response;

    const supabase = createAdminClient();
    
    // 1. Executar descoberta específica para esta fonte
    const result = await radarDiscoveryService.executeDiscovery(supabase, { sourceId });

    return NextResponse.json({
      status: 'success',
      totalInserted: result.totalInserted
    });

  } catch (error: any) {
    console.error('[RADAR-SYNC-API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
