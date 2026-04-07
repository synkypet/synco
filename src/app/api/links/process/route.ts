import { NextResponse } from 'next/server';
import { processLinks } from '@/lib/linkProcessor';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    // Basic auth check
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const links = body.links || [];

    if (!Array.isArray(links) || links.length === 0) {
      return NextResponse.json({ error: 'No links provided' }, { status: 400 });
    }

    // Buscar conexões do usuário de forma segura no server-side usando o token atual
    const { data: userConnections } = await supabase
      .from('user_marketplaces')
      .select('*, marketplaces(name)')
      .eq('user_id', user.id);

    const enrichedConnections = userConnections?.map(conn => ({
      ...conn,
      marketplace_name: conn.marketplaces?.name || ''
    })) || [];

    // Server-side processing with safely fetched user context
    const results = await processLinks(links, enrichedConnections);

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Error processing links via API:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
