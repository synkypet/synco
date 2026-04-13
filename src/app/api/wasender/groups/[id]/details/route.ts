import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WasenderClient } from '@/lib/wasender/client';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const logPrefix = `[MESH-DETAIL] [${new Date().toISOString()}]`;
  
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const groupId = params.id;
    console.log(`${logPrefix} Iniciando sync profundo para grupo local: ${groupId}`);

    // 1. Buscar o grupo e o canal vinculado
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id, remote_id, channel_id, channels(config)')
      .eq('id', groupId)
      .eq('user_id', user.id)
      .single();

    if (groupError || !group || !group.remote_id) {
       console.error(`${logPrefix} Grupo não encontrado ou sem remote_id: ${groupId}`);
       return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const { config } = group.channels as any;
    if (!config?.sessionId) {
       console.error(`${logPrefix} Sessão não configurada para o canal do grupo: ${groupId}`);
       return NextResponse.json({ error: 'Channel session not found' }, { status: 404 });
    }

    const sessionId = config.sessionId;
    const remoteId = group.remote_id;

    // 1.1 Buscar Session API Key nas secrets
    const { data: secrets } = await supabase
      .from('channel_secrets')
      .select('session_api_key')
      .eq('channel_id', group.channel_id)
      .single();

    let sessionApiKey = secrets?.session_api_key;
    
    // 1.2 PONTE DE AUTENTICAÇÃO AUTÔNOMA (Zero-User-Auth)
    if (!sessionApiKey || sessionApiKey.includes(':')) {
      console.log(`${logPrefix} Chave operacional ausente. Iniciando ponte administrativa para ${sessionId}...`);
      
      try {
        const sessionData = await WasenderClient.getSession(sessionId);
        const fetchedKey = sessionData.api_key || sessionData.data?.api_key;
        
        if (fetchedKey) {
          console.log(`${logPrefix} Chave recuperada com sucesso via PAT. Persistindo...`);
          
          await supabase.from('channel_secrets').upsert({
            channel_id: group.channel_id,
            user_id: user.id,
            session_api_key: fetchedKey,
            updated_at: new Date().toISOString()
          }, { onConflict: 'channel_id' });
          
          sessionApiKey = fetchedKey;
        }

        // Validação de estado físico da sessão
        const status = sessionData.status || sessionData.data?.status;
        if (status !== 'CONNECTED') {
           console.warn(`${logPrefix} Sessão em estado: ${status}. Abortando deep sync.`);
           return NextResponse.json({ 
             error: 'session_disconnected', 
             message: 'Sessão desconectada — reconecte via QR Code',
             status 
           }, { status: 400 });
        }
      } catch (bridgeErr: any) {
        console.error(`${logPrefix} Falha na ponte de autenticação administrativa:`, bridgeErr.message);
      }
    }

    // 2. Buscar dados na WasenderAPI (4 chamadas em paralelo para Malha Profunda)
    console.log(`${logPrefix} Buscando malha real para ${remoteId} (Session: ${sessionId})...`);
    const [metaRes, participantsRes, pictureRes, inviteRes] = await Promise.all([
      WasenderClient.getGroupMetadata(sessionId, remoteId, sessionApiKey).catch((err) => {
        console.warn(`${logPrefix} Erro ao buscar metadados:`, err.message);
        return null;
      }),
      WasenderClient.getGroupParticipants(sessionId, remoteId, sessionApiKey).catch((err) => {
        console.warn(`${logPrefix} Erro ao buscar integrantes:`, err.message);
        return null;
      }),
      WasenderClient.getGroupPicture(sessionId, remoteId, sessionApiKey).catch((err) => {
        console.warn(`${logPrefix} Erro ao buscar avatar:`, err.message);
        return null;
      }),
      WasenderClient.getGroupInviteLink(sessionId, remoteId, sessionApiKey).catch((err) => {
        console.warn(`${logPrefix} Erro ao buscar link de convite:`, err.message);
        return null;
      })
    ]);

    // Normalização de Payloads
    const metadata = metaRes?.data || metaRes;
    const rawParticipants = participantsRes?.data || participantsRes?.participants || participantsRes || [];
    const participants = Array.isArray(rawParticipants) ? rawParticipants : [];
    const pictureData = pictureRes?.data || pictureRes;
    const inviteData = inviteRes?.data || inviteRes;

    console.log(`${logPrefix} Resumo Malha: Meta=${!!metadata}, Members=${participants.length}, Avatar=${!!pictureData}, Link=${!!inviteData}`);

    // 3. Update minimal cache in groups table (last_seen_at, members_count, etc)
    if (metadata) {
      const groupOwner = metadata.owner?.jid || metadata.owner || metadata.creator || metadata.subjectOwner || null;
      
      const updateData: any = {
        members_count: participants.length,
        admin_count: participants.filter((p: any) => p.admin || p.isAdmin || p.role?.toLowerCase() === 'admin' || p.role?.toLowerCase() === 'superadmin' || p.isSuperAdmin).length,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      if (pictureData?.url || pictureData?.image || metadata.avatar || metadata.profile_picture) {
         updateData.avatar_url = pictureData?.url || pictureData?.image || metadata.avatar || metadata.profile_picture;
      }
      if (metadata.subject || metadata.name) {
         updateData.name = metadata.subject || metadata.name;
      }
      
      await supabase.from('groups').update(updateData).eq('id', groupId);
    }

    // 4. Format participants for the frontend
    const groupOwnerFormatted = metadata?.owner?.jid || metadata?.owner || metadata?.creator || metadata?.subjectOwner || null;
    const formattedParticipants = participants.map((p: any) => {
      const pJid = p.jid;
      const pLid = p.id || p.remote_id;
      const bestId = pJid || pLid;
      
      const normalize = (id: string) => id?.split('@')[0];
      const isOwner = normalize(pJid) === normalize(groupOwnerFormatted) || 
                      normalize(pLid) === normalize(groupOwnerFormatted) || 
                      pJid === groupOwnerFormatted || 
                      pLid === groupOwnerFormatted;

      const rawRole = (p.role || '').toLowerCase();
      const isAdminFlag = p.admin || p.isAdmin || rawRole === 'admin' || rawRole === 'superadmin' || p.is_admin || p.isSuperAdmin;
      
      let role = 'member';
      if (isOwner) {
        role = 'creator';
      } else if (rawRole === 'superadmin' || p.isSuperAdmin) {
        role = 'superadmin';
      } else if (isAdminFlag) {
        role = 'admin';
      }
      
      return {
        remote_id: bestId,
        push_name: p.pushName || p.pushname || p.name || p.verifiedName || null,
        avatar_url: p.avatar_url || null,
        role: role
      };
    }).filter((p: any) => p.remote_id);

    return NextResponse.json({ 
      success: true, 
      metadata: {
        description: metadata?.description || metadata?.desc || null,
        invite_link: inviteData?.url || inviteData?.link || metadata?.invite_link || metadata?.link || null,
        owner: groupOwnerFormatted,
        remote_created_at: (metadata?.creation || metadata?.createdAt) ? new Date((metadata.creation || metadata.createdAt) * 1000).toISOString() : null,
        permissions: metadata?.permissions || {},
        avatar_url: pictureData?.url || pictureData?.image || metadata?.avatar || metadata?.profile_picture || null,
      },
      participants: formattedParticipants
    });

  } catch (error: any) {
    console.error(`${logPrefix} ERRO GET /api/wasender/groups/[id]/details:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
