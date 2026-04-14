import { createClient } from '@/lib/supabase/server';
import { WasenderClient } from '@/lib/wasender/client';
import { NextResponse } from 'next/server';

/**
 * POST /api/wasender/test-send
 * Envio de mensagem manual para teste de telemetria
 */
export async function POST(request: Request) {
  const logPrefix = `[TEST-SEND] [${new Date().toISOString()}]`;
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { channelId, phone, message } = await request.json();

    if (!channelId || !phone || !message) {
      return NextResponse.json({ 
        error: 'Campos obrigatórios ausentes (channelId, phone, message)' 
      }, { status: 400 });
    }

    // 1. Buscar metadados do canal
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('id, config, user_id')
      .eq('id', channelId)
      .single();

    if (channelError || !channel) {
      return NextResponse.json({ error: 'Canal não encontrado' }, { status: 404 });
    }

    if (channel.user_id !== user.id) {
      return NextResponse.json({ error: 'Acesso negado ao canal' }, { status: 403 });
    }

    const wasenderSessionId = channel.config?.wasender_session_id;
    if (!wasenderSessionId) {
      return NextResponse.json({ 
        error: 'Este canal não possui uma sessão Wasender configurada.' 
      }, { status: 422 });
    }

    // 2. Buscar segredos (API Key da Sessão)
    const { data: secrets, error: secretsError } = await supabase
      .from('channel_secrets')
      .select('session_api_key')
      .eq('channel_id', channelId)
      .single();

    let sessionApiKey = secrets?.session_api_key;

    // Ponte de autenticação: se a chave não estiver no banco, tenta buscar na Wasender
    if (!sessionApiKey) {
      console.log(`${logPrefix} Chave não encontrada no DB para canal ${channelId}. Buscando na Wasender...`);
      try {
        const sessionData = await WasenderClient.getSession(wasenderSessionId);
        const fetchedKey = sessionData.api_key || sessionData.data?.api_key || sessionData.session_api_key;
        
        if (fetchedKey) {
          await supabase.from('channel_secrets').upsert({
            channel_id: channelId,
            user_id: user.id,
            session_api_key: fetchedKey,
            updated_at: new Date().toISOString()
          }, { onConflict: 'channel_id' });
          sessionApiKey = fetchedKey;
        }
      } catch (e: any) {
        console.warn(`${logPrefix} Falha na ponte de recuperação de API Key:`, e.message);
      }
    }

    if (!sessionApiKey) {
      return NextResponse.json({ 
        error: 'Não foi possível recuperar a chave de API da sessão WhatsApp.' 
      }, { status: 422 });
    }

    // 3. Executar o envio via WasenderClient
    console.log(`${logPrefix} >>> DISPARANDO ENVIO MANUAL:`);
    console.log(`${logPrefix} [AUDIT] Canal: ${channelId}`);
    console.log(`${logPrefix} [AUDIT] Session: ${wasenderSessionId}`);
    console.log(`${logPrefix} [AUDIT] Destino: ${phone}`);
    console.log(`${logPrefix} [AUDIT] Chave (prefix): ${sessionApiKey.substring(0, 8)}...`);

    const sendRes = await WasenderClient.sendMessage(sessionApiKey, phone, message);

    console.log(`${logPrefix} [SUCCESS] Retorno do Provedor:`, JSON.stringify(sendRes).substring(0, 100));

    return NextResponse.json({
      success: true,
      data: sendRes
    });

  } catch (error: any) {
    console.error(`${logPrefix} Erro no envio manual:`, error.message);
    return NextResponse.json({ 
      error: 'Erro ao enviar mensagem', 
      details: error.message 
    }, { status: 502 });
  }
}
