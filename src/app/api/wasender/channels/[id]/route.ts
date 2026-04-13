import { createClient } from '@/lib/supabase/server';
import { WasenderClient } from '@/lib/wasender/client';
import { NextResponse } from 'next/server';

/**
 * GET /api/wasender/channels/[id]
 * Consulta status real na Wasender e sincroniza localmente
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const channel_id = params.id;
  const logPrefix = `[CHANNEL-STATUS] [${new Date().toISOString()}]`;
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data: channel, error: fetchErr } = await supabase
      .from('channels')
      .select('config, user_id')
      .eq('id', channel_id)
      .single();

    if (fetchErr || !channel) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    if (channel.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // REGRA: Apenas use o ID numérico. Se não tiver, o canal precisa de reconfiguração
    const wasenderId = channel.config?.wasender_session_id;

    if (!wasenderId) {
       console.warn(`${logPrefix} Canal legado detectado (sem wasender_session_id): ${channel_id}`);
       return NextResponse.json({ 
         success: false, 
         error: 'Canal legado. Reconfiguração necessária.', 
         reason: 'LEGACY_CHANNEL_RECONFIG_NEEDED' 
       }, { status: 422 });
    }

    // Buscar API key nas secrets
    const { data: secrets } = await supabase.from('channel_secrets').select('session_api_key').eq('channel_id', channel_id).single();
    if (!secrets?.session_api_key) {
        console.warn(`${logPrefix} Session API Key ausente para canal: ${channel_id}`);
    }

    console.log(`${logPrefix} Refrescando status (Wasender ID: ${wasenderId})...`);
    const statusData = await WasenderClient.getStatus(wasenderId, secrets?.session_api_key);
    const wasenderStatus = (statusData.status || statusData.data?.status || 'unknown').toLowerCase();

    // Mapeamento de Status
    let localStatus = channel.config?.wasender_status || 'unknown';
    if (wasenderStatus.includes('connected')) localStatus = 'connected';
    else if (wasenderStatus.includes('qrcode') || wasenderStatus.includes('need_scan')) localStatus = 'need_scan';
    else if (wasenderStatus.includes('disconnected')) localStatus = 'disconnected';
    else if (wasenderStatus.includes('logged_out') || wasenderStatus.includes('expired')) localStatus = 'logged_out';

    const updatedConfig = {
      ...channel.config,
      wasender_status: localStatus,
      last_status_check: new Date().toISOString()
    };

    await supabase.from('channels').update({ config: updatedConfig }).eq('id', channel_id);

    return NextResponse.json({
      success: true,
      status: localStatus,
      raw_status: wasenderStatus,
      wasenderId
    });

  } catch (error: any) {
    console.error(`${logPrefix} Erro no status check:`, error.message);
    return NextResponse.json({ 
      success: false, 
      error: 'Falha ao consultar Wasender', 
      details: error.message 
    }, { status: 502 });
  }
}

/**
 * DELETE /api/wasender/channels/[id]
 * Ciclo Estrito: Delete Remoto (Wasender) -> Soft Delete Local
 */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const channel_id = params.id;
  const logPrefix = `[CHANNEL-DELETE] [${new Date().toISOString()}]`;
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // 1. Buscar metadados do canal
    const { data: channel } = await supabase
      .from('channels')
      .select('config, user_id')
      .eq('id', channel_id)
      .single();

    if (!channel || channel.user_id !== user.id) {
       return NextResponse.json({ error: 'Channel not found/Unauthorized' }, { status: 404 });
    }

    const wasenderId = channel.config?.wasender_session_id;

    // 2. Exclusão Remota (ID Numérico)
    if (wasenderId) {
      console.log(`${logPrefix} Tentando exclusão remota da sessão ${wasenderId}...`);
      try {
        await WasenderClient.deleteSession(wasenderId);
        console.log(`${logPrefix} ✅ Sessão remota excluída com sucesso.`);
      } catch (wsErr: any) {
        // Se for 404 (Sessão já não existe na Wasender), permitimos o soft-delete local
        if (wsErr.message.includes('404') || wsErr.message.includes('Not Found')) {
            console.warn(`${logPrefix} Sessão remota não encontrada (404). Prosseguindo com limpeza local.`);
        } else {
            console.error(`${logPrefix} Erro remoto CRÍTICO:`, wsErr.message);
            return NextResponse.json({ 
                success: false, 
                error: 'Falha na exclusão remota. A sessão Wasender ainda pode estar ativa.', 
                details: wsErr.message 
            }, { status: 502 });
        }
      }
    } else {
      console.log(`${logPrefix} Canal sem wasender_session_id (LEGADO). Prosseguindo com limpeza local.`);
    }

    // 3. Exclusão de Segredos (Opcional mas boa prática)
    await supabase.from('channel_secrets').delete().eq('channel_id', channel_id);

    // 4. Soft Delete local
    const { error: dbError } = await supabase
      .from('channels')
      .update({ 
          is_active: false, 
          updated_at: new Date().toISOString()
      })
      .eq('id', channel_id);

    if (dbError) throw dbError;

    console.log(`${logPrefix} ✅ Soft-delete local ${channel_id} concluído.`);
    return NextResponse.json({ success: true, message: 'Canal desativado e sessão remota removida.' });

  } catch (error: any) {
    console.error(`${logPrefix} ERRO:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const channel_id = params.id;
  const logPrefix = `[CHANNEL-DISCONNECT] [${new Date().toISOString()}]`;
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { action } = await request.json();
    if (action !== 'disconnect') return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    const { data: channel } = await supabase
      .from('channels')
      .select('config, user_id')
      .eq('id', channel_id)
      .single();

    if (!channel || channel.user_id !== user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const wasenderId = channel.config?.wasender_session_id;

    if (wasenderId) {
       console.log(`${logPrefix} Executando logout remoto para ID ${wasenderId}...`);
       await WasenderClient.logoutSession(wasenderId);
    }

    const updatedConfig = { ...channel.config, wasender_status: 'disconnected' };
    await supabase.from('channels').update({ config: updatedConfig }).eq('id', channel_id);

    return NextResponse.json({ success: true, status: 'disconnected' });

  } catch (error: any) {
    console.error(`${logPrefix} Erro no logout:`, error.message);
    return NextResponse.json({ error: 'Erro ao desconectar na Wasender', details: error.message }, { status: 502 });
  }
}
