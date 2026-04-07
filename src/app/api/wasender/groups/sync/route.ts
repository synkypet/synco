import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WasenderClient } from '@/lib/wasender/client';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { channel_id } = await request.json();

    if (!channel_id) {
       return NextResponse.json({ error: 'channel_id is required' }, { status: 400 });
    }

    // 1. Validar autorização e extrair sessionId
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('config')
      .eq('id', channel_id)
      .eq('user_id', user.id)
      .single();

    if (channelError || !channel || !channel.config || !channel.config.sessionId) {
       return NextResponse.json({ error: 'Session not initialized for this channel' }, { status: 404 });
    }

    const sessionId = channel.config.sessionId;

    // 2. Buscar grupos na API externa
    const wasenderGroups = await WasenderClient.getGroups(sessionId);
    
    // Assumir o formato { data: [ { id: "123@g.us", name: "Alpha", size: 10 } ] }
    const externalGroups = wasenderGroups.data || wasenderGroups.groups || wasenderGroups;
    if (!Array.isArray(externalGroups)) {
       throw new Error('Invalid format returned from Wasender API groups endpoint');
    }

    // 3. Preparar e executar Upsert dos grupos
    // A tabela `groups` requer user_id, channel_id, name, remote_id e status.
    const upsertPayload = externalGroups.map((g: any) => ({
      user_id: user.id,
      channel_id: channel_id,
      remote_id: g.id || g.jid, 
      name: g.name || g.subject || 'Grupo sem nome',
      status: 'active',
      members_count: g.size || g.participants?.length || 0,
      is_active: true
    }));

    // Optamos por fazer o upsert utilizando remote_id como chave de conflito 
    // Para isso funcionar perfeitamente, idealmente remote_id + channel_id deveriam ser unique 
    // Como a migration initial não criou essa UNIQUE constrant, o upsert do supabase 
    // requer o onConflict. Vamos fazer um fallback: buscar todos e atualizar/inserir um a um.
    // Isso é mais seguro para o DB sem alterar constraints profundas.

    const { data: existingGroups } = await supabase
      .from('groups')
      .select('id, remote_id')
      .eq('channel_id', channel_id);

    const toInsert = [];
    const toUpdate = [];

    for (const group of upsertPayload) {
       const exists = existingGroups?.find(eg => eg.remote_id === group.remote_id);
       if (exists) {
          toUpdate.push({ ...group, id: exists.id, updated_at: new Date().toISOString() });
       } else {
          toInsert.push(group);
       }
    }

    if (toInsert.length > 0) {
      await supabase.from('groups').insert(toInsert);
    }
    if (toUpdate.length > 0) {
       await supabase.from('groups').upsert(toUpdate);
    }

    // 4. Update lastSyncAt no Canal
    const newConfig = { ...channel.config, lastSyncAt: new Date().toISOString() };
    await supabase.from('channels').update({ config: newConfig }).eq('id', channel_id);

    return NextResponse.json({ 
        success: true, 
        synced: upsertPayload.length,
        inserted: toInsert.length,
        updated: toUpdate.length
    });

  } catch (error: any) {
    console.error('Wasender Groups Sync POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
