import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WasenderClient } from '@/lib/wasender/client';
import { WasenderConfig } from '@/types/group';

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

    // 1. Validar se o canal pertence ao usuário
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, name')
      .eq('id', channel_id)
      .eq('user_id', user.id)
      .single();

    if (channelError || !channel) {
       return NextResponse.json({ error: 'Channel not found or unauthorized' }, { status: 404 });
    }

    // 2. Criar sessão na Wasender (nomeamos como synco_sessao_userId_channelId para facilitar dump externo)
    const sessionName = `synco_sessao_${user.id}_${channel.id}`;
    const wasenderSession = await WasenderClient.createSession(sessionName);
    
    // Assumindo retornos comuns da WasenderAPI: { id: "xx", session_api_key: "yy" } ou similar
    const sessionId = wasenderSession.id || wasenderSession.session_id || sessionName; 
    const sessionApiKey = wasenderSession.session_api_key || wasenderSession.api_key || '';

    // 3. Salvar o segredo rigidamente em channel_secrets
    const { error: secretsError } = await supabase
      .from('channel_secrets')
      .upsert({
         channel_id,
         user_id: user.id,
         session_api_key: sessionApiKey
      });

    if (secretsError) {
      throw new Error(`Failed to save secrets: ${secretsError.message}`);
    }

    // 4. Salvar metadados no config JSONB (channels)
    const configUpdate: WasenderConfig = {
       sessionId,
       status: 'qrcode_pending',
    };

    await supabase
      .from('channels')
      .update({ config: configUpdate })
      .eq('id', channel_id);

    // 5. Acionar o endpoint de "connect" para a sessão criada
    await WasenderClient.connectSession(sessionId);

    return NextResponse.json({ success: true, sessionId, status: 'qrcode_pending' });
  } catch (error: any) {
    console.error('Wasender Session POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const channel_id = searchParams.get('channel_id');

    if (!channel_id) {
      return NextResponse.json({ error: 'channel_id is required' }, { status: 400 });
    }

    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Pegar a config do canal
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

    // 2. Checar status realtime na Wasender
    let realStatus;
    try {
        const wasenderStatus = await WasenderClient.getStatus(sessionId);
        // Mapear o status da wasender para o nosso domínio se necessário. 
        // Ex: "AWAITING_SCAN" -> "qrcode_pending", "CONNECTED" -> "connected"
        const remoteStatus = (wasenderStatus.status || '').toUpperCase();
        
        if (remoteStatus.includes('CONNECTED')) realStatus = 'connected';
        else if (remoteStatus.includes('QR') || remoteStatus.includes('SCAN') || remoteStatus.includes('PENDING')) realStatus = 'qrcode_pending';
        else if (remoteStatus.includes('DISCONNECTED')) realStatus = 'disconnected';
        else realStatus = 'session_lost';

    } catch (e) {
        realStatus = 'sync_failed';
    }

    // 3. Atualizar o banco de dados se o status mudou
    if (channel.config.status !== realStatus) {
        const newConfig = { ...channel.config, status: realStatus };
        await supabase
          .from('channels')
          .update({ config: newConfig })
          .eq('id', channel_id);
    }

    return NextResponse.json({ status: realStatus });

  } catch (error: any) {
    console.error('Wasender Session GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
