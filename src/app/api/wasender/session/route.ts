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

    const { channel_id, phone_number } = await request.json();

    if (!channel_id) {
       return NextResponse.json({ error: 'channel_id is required' }, { status: 400 });
    }

    if (!phone_number) {
       return NextResponse.json({ error: 'phone_number is required' }, { status: 400 });
    }

    // 1. Validar se o canal pertence ao usuário
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, name, config')
      .eq('id', channel_id)
      .eq('user_id', user.id)
      .single();

    if (channelError || !channel) {
       return NextResponse.json({ error: 'Channel not found or unauthorized' }, { status: 404 });
    }

    // 2. Verificar se já existe uma sessão para este canal
    const existingSessionId = channel.config?.sessionId;
    
    if (existingSessionId) {
      // Sessão já existe — reconectar em vez de criar nova
      try {
        await WasenderClient.connectSession(existingSessionId);
        
        await supabase
          .from('channels')
          .update({ config: { ...channel.config, status: 'qrcode_pending' } })
          .eq('id', channel_id);

        return NextResponse.json({ success: true, sessionId: existingSessionId, status: 'qrcode_pending' });
      } catch (connectError: any) {
        console.log('Reconnect failed, will create new session:', connectError.message);
        // Se falhar (sessão deletada no Wasender), continuar e criar nova
      }
    }

    // 3. Construir webhook URL — só envia se for uma URL pública (não localhost)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const isPublicUrl = appUrl && !appUrl.includes('localhost') && !appUrl.includes('127.0.0.1');
    const webhookUrl = isPublicUrl ? `${appUrl}/api/webhooks/wasender` : undefined;

    // 4. Criar sessão na Wasender com todos os campos obrigatórios
    const sessionName = `synco_${user.id}_${channel.id}`;
    const wasenderSession = await WasenderClient.createSession({
      name: sessionName,
      phoneNumber: phone_number,
      webhookUrl: webhookUrl
    });
    
    // A API retorna: { success: true, data: { id, api_key, webhook_secret, ... } }
    const sessionData = wasenderSession.data || wasenderSession;
    const sessionId = String(sessionData.id || sessionData.session_id || sessionName); 
    const sessionApiKey = sessionData.api_key || sessionData.session_api_key || '';
    const webhookSecret = sessionData.webhook_secret || '';

    // 5. Salvar os segredos rigidamente em channel_secrets
    const { error: secretsError } = await supabase
      .from('channel_secrets')
      .upsert({
         channel_id,
         user_id: user.id,
         session_api_key: sessionApiKey,
         webhook_secret: webhookSecret
      });

    if (secretsError) {
      throw new Error(`Failed to save secrets: ${secretsError.message}`);
    }

    // 6. Salvar metadados no config JSONB (channels) — SEM segredos
    const configUpdate: WasenderConfig = {
       sessionId,
       status: 'qrcode_pending',
       phoneNumber: phone_number,
    };

    await supabase
      .from('channels')
      .update({ config: configUpdate })
      .eq('id', channel_id);

    // 7. Acionar o endpoint de "connect" para a sessão criada
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
