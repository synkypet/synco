import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WasenderClient } from '@/lib/wasender/client';

export async function GET() {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const supabase = createClient();
  const logPrefix = `[DEBUG-MESH] [${new Date().toISOString()}]`;
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Pegar um canal para teste
    const { data: channel } = await supabase
      .from('channels')
      .select('id, config')
      .limit(1)
      .single();

    if (!channel?.config?.sessionId) {
      return NextResponse.json({ error: 'Nenhum canal configurado' });
    }

    const sessionId = channel.config.sessionId;
    
    // 2. Testar Wasender API
    let wasenderRes;
    try {
      wasenderRes = await WasenderClient.getGroups(sessionId);
    } catch (e: any) {
      return NextResponse.json({ phase: 'wasender', error: e.message });
    }

    const groups = wasenderRes.data || wasenderRes.groups || wasenderRes;
    const sampleGroup = Array.isArray(groups) ? groups[0] : null;

    if (!sampleGroup) {
      return NextResponse.json({ phase: 'wasender', message: 'Nenhum grupo retornado', raw: wasenderRes });
    }

    // 3. Testar Persistência no Supabase para ver o erro exato
    const testPayload = {
      user_id: user.id,
      channel_id: channel.id,
      remote_id: sampleGroup.id || sampleGroup.jid || 'test-jid',
      name: sampleGroup.name || sampleGroup.subject || 'Teste Debug',
      status: 'active',
      members_count: sampleGroup.size || 0,
      avatar_url: sampleGroup.avatar || null,
      is_active: true,
      updated_at: new Date().toISOString()
    };

    const { data: synced, error: dbError } = await supabase
      .from('groups')
      .upsert([testPayload], { onConflict: 'channel_id,remote_id' })
      .select();

    return NextResponse.json({
      phase: 'final',
      wasender_sample_keys: Object.keys(sampleGroup),
      wasender_sample_data: sampleGroup,
      supabase_payload: testPayload,
      supabase_error: dbError,
      supabase_synced: synced
    });

  } catch (err: any) {
    return NextResponse.json({ phase: 'crash', error: err.message });
  }
}
