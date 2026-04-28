import { NextResponse } from 'next/server';
import { processLinks } from '@/lib/linkProcessor';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { decrypt, EncryptedData } from '@/lib/encryption';
import { requireOperationalAccess } from '@/lib/access/require-operational-access';

export async function POST(request: Request) {
  try {
    // Auth and Access Gate
    const gate = await requireOperationalAccess();
    if (!gate.ok) return gate.response;
    const { user } = gate;

    const body = await request.json();
    const { links = [], tone = 'auto' } = body;

    if (!Array.isArray(links) || links.length === 0) {
      return NextResponse.json({ error: 'No links provided' }, { status: 400 });
    }

    // Buscar conexões do usuário de forma segura no server-side com segredos descriptografados
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, 
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { marketplaceService } = await import('@/services/supabase/marketplace-service');
    const enrichedConnections = await marketplaceService.getEnrichedConnections(user.id, supabaseAdmin);

    // Server-side processing with tone support
    const snapshots = await processLinks(links, enrichedConnections, tone);

    return NextResponse.json({ 
      status: 'SUCCESS',
      results: snapshots 
    });
  } catch (error: any) {
    console.error('Error processing links via API:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
