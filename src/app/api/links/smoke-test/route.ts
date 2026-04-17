import { NextResponse } from 'next/server';
import { processLinks } from '@/lib/linkProcessor';
import { createClient as createAdminClient } from '@supabase/supabase-js';

// Rota temporária para Validação Operacional (NÃO MERGEAR PARA MAIN)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { links = [], tone = 'auto', userId } = body;

    if (!links.length || !userId) {
      return NextResponse.json({ error: 'Missing links or userId' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, 
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { marketplaceService } = await import('@/services/supabase/marketplace-service');
    const enrichedConnections = await marketplaceService.getEnrichedConnections(userId, supabaseAdmin);

    const snapshots = await processLinks(links, enrichedConnections, tone);

    return NextResponse.json({ 
      status: 'SUCCESS',
      results: snapshots 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
