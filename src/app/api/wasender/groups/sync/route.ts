import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WasenderClient } from '@/lib/wasender/client';
import fs from 'fs';
import path from 'path';
import { requireOperationalAccess, requireGroupLimit } from '@/lib/access/require-operational-access';

export async function POST(request: Request) {
  const logPrefix = `[MESH-SYNC] [${new Date().toISOString()}]`;
  
  try {
    const gate = await requireOperationalAccess();
    if (!gate.ok) return gate.response;
    const { user, access } = gate;
    const supabase = createClient();

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
    
    console.log(`${logPrefix} Grupos recebidos da Wasender: ${fetchedCount}`);

    // Map dos IDs existentes no banco para detectar novos e preservar valores
    const { data: existingGroups } = await supabase
      .from('groups')
      .select('remote_id, members_count, admin_count')
      .eq('channel_id', channel_id);
    
    const existingMap = new Map((existingGroups || []).map(g => [g.remote_id, g]));

    // 3. Executar Upsert dos grupos
    const detectedNewIds: string[] = [];
    const ignoredGroups: any[] = [];
    
    const upsertPayload = Array.isArray(externalGroups) ? externalGroups.map((g: any) => {
      const remoteId = g.id || g.jid || g.remote_id;
      
      if (!remoteId) {
        ignoredGroups.push({ name: g.name || 'Sem nome', reason: 'MISSING_REMOTE_ID', raw: g });
        return null;
      }

      if (!existingMap.has(remoteId)) {
        detectedNewIds.push(remoteId);
      }

      const existingData = existingMap.get(remoteId);
      const incomingMembers = g.size || g.participants?.length || g.members_count || 0;
      const incomingAdmins = g.admin_count || 0;

      // Estratégia Segura: se veio 0 da malha superficial, preserva valor antigo (se houver)
      const finalMembersCount = incomingMembers > 0 ? incomingMembers : (existingData?.members_count || 0);
      const finalAdminCount = incomingAdmins > 0 ? incomingAdmins : (existingData?.admin_count || 0);

      // Log para auditoria de persistência
      if (incomingMembers === 0 && (existingData?.members_count || 0) > 0) {
         console.warn(`${logPrefix} [PRESERVED] ${g.name || remoteId}: Members returned 0. Preservando = ${finalMembersCount}`);
      }
      if (incomingAdmins === 0 && (existingData?.admin_count || 0) > 0) {
         console.warn(`${logPrefix} [PRESERVED] ${g.name || remoteId}: Admins returned 0. Preservando = ${finalAdminCount}`);
      }

      return {
        user_id: user.id,
        channel_id: channel_id,
        remote_id: remoteId, 
        name: (g.name || g.subject || g.pushName || 'Grupo sem nome').trim(),
        status: 'active',
        members_count: finalMembersCount,
        admin_count: finalAdminCount,
        avatar_url: g.avatar || g.profile_picture || g.image || g.imgUrl || null,
        description: g.description || g.desc || null,
        owner: g.owner?.jid || g.owner || g.creator || g.subjectOwner || null,
        remote_created_at: (g.creation || g.createdAt) ? new Date((g.creation || g.createdAt) * 1000).toISOString() : null,
        permissions: g.permissions || {},
        invite_link: g.invite_link || g.link || null,
        is_active: true,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }).filter(Boolean) : [];

    console.log(`${logPrefix} Total Mapeado para Upsert: ${upsertPayload.length}`);
    if (ignoredGroups.length > 0) {
      console.warn(`${logPrefix} Grupos Ignorados (${ignoredGroups.length}):`, ignoredGroups.map(i => i.name));
    }
    if (detectedNewIds.length > 0) {
      console.log(`${logPrefix} Novos Remote IDs detectados (${detectedNewIds.length}):`, detectedNewIds);
    }

    // Contagem antes para estatística
    const { count: oldCount } = await supabase
      .from('groups')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channel_id);

    // GATE 2: Group Limit
    if (detectedNewIds.length > 0) {
      const limitError = await requireGroupLimit(user.id, detectedNewIds.length, access.quotas);
      if (limitError) return limitError;
    }

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

    console.log(`${logPrefix} Persistência concluída. Total no banco para este canal: ${currentCount} (Recém-criados/Novos detectados: ${newGroupsCount})`);

    // 4. Reconciliação (Janela segura de 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error: deleteError, count: deletedCount } = await supabase
      .from('groups')
      .delete({ count: 'exact' })
      .eq('channel_id', channel_id)
      .lt('last_seen_at', twentyFourHoursAgo);

    if (!deleteError && deletedCount && deletedCount > 0) {
      console.log(`${logPrefix} GC Executado: Removidos ${deletedCount} grupos ausentes há mais de 24h.`);
    }

    // 5. Update lastSyncAt
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
