// src/app/api/wa/groups/route.ts
// Leitura LOCAL dos grupos sincronizados — evita chamar Wasender a cada render.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const channel_id = searchParams.get('channel_id');

    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Montar query base
    let query = supabase
      .from('groups')
      .select('id, channel_id, remote_id, name, status, is_source, is_destination, is_monitored, members_count, tags, is_active, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('name', { ascending: true });

    // Filtro opcional por canal
    if (channel_id) {
      query = query.eq('channel_id', channel_id);
    }

    const { data: groups, error: groupsError } = await query;

    if (groupsError) {
      throw new Error(`Failed to fetch groups: ${groupsError.message}`);
    }

    return NextResponse.json({ groups: groups || [] });

  } catch (error: any) {
    console.error('Local Groups GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
