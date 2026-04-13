import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WasenderClient } from '@/lib/wasender/client';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  const logPrefix = `[MESH-SYNC] [${new Date().toISOString()}]`;
  
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { channel_id, force_restart = false } = await request.json();

    if (!channel_id) {
       return NextResponse.json({ error: 'channel_id is required' }, { status: 400 });
    }

    console.log(`${logPrefix} Iniciando sync rápido para canal: ${channel_id} (Force: ${force_restart})`);

    // 1. Validar autorização e extrair sessionId
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('config, user_id, name')
      .eq('id', channel_id)
      .single();

    if (channelError || !channel) {
       console.error(`${logPrefix} Canal não encontrado ou sem acesso: ${channel_id}`);
       return NextResponse.json({ 
         success: false, 
         error: 'Channel not found', 
         reason: 'CHANNEL_NOT_FOUND' 
       }, { status: 404 });
    }

    const wasenderId = channel.config?.wasender_session_id || channel.config?.sessionId;

    if (!wasenderId) {
       console.warn(`${logPrefix} Canal sem ID de sessão Wasender configurado: ${channel_id}`);
       return NextResponse.json({ 
         success: false, 
         error: 'Wasender session not initialized', 
         reason: 'MISSING_WASENDER_ID' 
       }, { status: 422 });
    }

    if (channel.user_id !== user.id) {
       return NextResponse.json({ error: 'Unauthorized channel access' }, { status: 403 });
    }

    // 1.4 Buscar Session API Key nas secrets
    const { data: secrets } = await supabase
      .from('channel_secrets')
      .select('session_api_key')
      .eq('channel_id', channel_id)
      .single();

    let sessionApiKey = secrets?.session_api_key;
    
    // 1.5 RESTART SE FORÇADO
    if (force_restart) {
       console.log(`${logPrefix} Comando FORÇAR RESTART recebido para ID ${wasenderId}...`);
       await WasenderClient.restartSession(wasenderId);
       console.log(`${logPrefix} Restart enviado. Aguardando 5 segundos...`);
       await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // 1.6 PONTE DE AUTENTICAÇÃO SE CHAVE AUSENTE
    if (!sessionApiKey || sessionApiKey.length < 10) {
      console.log(`${logPrefix} Chave operacional ausente. Iniciando ponte para ID ${wasenderId}...`);
      try {
        const sessionData = await WasenderClient.getSession(wasenderId);
        const fetchedKey = sessionData.api_key || sessionData.data?.api_key || sessionData.session_api_key;
        
        if (fetchedKey) {
          await supabase.from('channel_secrets').upsert({
            channel_id, user_id: user.id, session_api_key: fetchedKey, updated_at: new Date().toISOString()
          }, { onConflict: 'channel_id' });
          sessionApiKey = fetchedKey;
        }
      } catch (e: any) {
        console.warn(`${logPrefix} Falha na ponte de auth:`, e.message);
      }
    }

    // 1.7 PRÉ-CHECK DE STATUS
    console.log(`${logPrefix} Verificando status da sessão ${wasenderId}...`);
    let sessionStatus = 'unknown';
    
    try {
      const statusRes = await WasenderClient.getStatus(wasenderId, sessionApiKey);
      sessionStatus = (statusRes.status || statusRes.data?.status || 'unknown').toLowerCase();
      
      console.log(`${logPrefix} Status Real Wasender: ${sessionStatus}`);

      // Atualizar status no banco
      await supabase.from('channels').update({
        config: { ...channel.config, wasender_status: sessionStatus }
      }).eq('id', channel_id);

      if (!sessionStatus.includes('connected')) {
        console.warn(`${logPrefix} Abortando sync: Sessão desconectada (${sessionStatus})`);
        return NextResponse.json({
          success: false,
          reason: 'SESSION_NOT_CONNECTED',
          sessionStatus,
          wasenderId,
          message: `Sessão no estado: ${sessionStatus}`
        }, { status: 412 });
      }
    } catch (err: any) {
      console.error(`${logPrefix} Erro ao verificar status:`, err.message);
      // Continuamos se já temos a apikey, pode ser erro temporário do status endpoint
    }

    // 2. Buscar grupos na API externa
    console.log(`${logPrefix} Buscando grupos na Wasender para ID ${wasenderId}...`);

    let wasenderGroups;
    try {
      wasenderGroups = await WasenderClient.getGroups(wasenderId, sessionApiKey);
    } catch (apiErr: any) {
      console.error(`${logPrefix} Falha ao buscar grupos:`, apiErr.message);
      return NextResponse.json({
        success: false,
        error: 'Wasender API Error',
        message: apiErr.message
      }, { status: 502 });
    }

    const externalGroups = wasenderGroups.data || wasenderGroups.groups || (Array.isArray(wasenderGroups) ? wasenderGroups : []);
    const fetchedCount = Array.isArray(externalGroups) ? externalGroups.length : 0;
    
    console.log(`${logPrefix} Grupos recebidos: ${fetchedCount}`);

    // 3. Executar Upsert dos grupos
    const upsertPayload = Array.isArray(externalGroups) ? externalGroups.map((g: any) => {
      const remoteId = g.id || g.jid || g.remote_id;
      if (!remoteId) return null;

      return {
        user_id: user.id,
        channel_id: channel_id,
        remote_id: remoteId, 
        name: g.name || g.subject || g.pushName || 'Grupo sem nome',
        status: 'active',
        members_count: g.size || g.participants?.length || g.members_count || 0,
        avatar_url: g.avatar || g.profile_picture || g.image || g.imgUrl || null,
        is_active: true,
        updated_at: new Date().toISOString()
      };
    }).filter(Boolean) : [];

    // Contagem antes para estatística
    const { count: oldCount } = await supabase
      .from('groups')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channel_id);

    const { data: syncedData, error: upsertError } = await supabase
      .from('groups')
      .upsert(upsertPayload, { onConflict: 'channel_id,remote_id' })
      .select('id');

    if (upsertError) {
      console.error(`${logPrefix} Erro no Upsert Supabase:`, upsertError);
      return NextResponse.json({ success: false, error: 'Database Persistence Error' }, { status: 500 });
    }

    const currentCount = syncedData?.length || 0;
    const previousCount = oldCount || 0;
    const newGroupsCount = Math.max(0, currentCount - previousCount);

    // 4. Update lastSyncAt
    await supabase.from('channels').update({ 
      config: { 
        ...channel!.config, 
        wasender_status: sessionStatus,
        lastSyncAt: new Date().toISOString() 
      } 
    }).eq('id', channel_id);

    return NextResponse.json({ 
        success: true, 
        fetchedCount,
        persistedCount: currentCount,
        newGroupsCount,
        wasenderId,
        sessionStatus,
        message: `Sincronização concluída com ${fetchedCount} grupos.`
    });

  } catch (error: any) {
    console.error(`[MESH-SYNC] CRITICAL ERROR:`, error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
