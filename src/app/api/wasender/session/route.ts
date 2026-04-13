import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WasenderClient } from '@/lib/wasender/client';
import { WasenderConfig } from '@/types/group';

export const dynamic = 'force-dynamic';

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
    let wasenderId = channel.config?.wasender_session_id;
    
    // Se não tem ID mas recebemos um número de telefone, tentamos CRIAR (Reparação de canal legado)
    if (!wasenderId && phone_number) {
        console.log(`[SESSION-SHIM] Reparando canal legado ${channel_id}. Criando nova sessão na Wasender...`);
        
        const finalPhone = phone_number.replace(/\D/g, '');
        const e164Phone = `+${finalPhone}`;

        try {
            const wasenderSession = await WasenderClient.createSession({
                name: `SYNCO - ${channel.name}`,
                phoneNumber: e164Phone,
                webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://synco-mocha.vercel.app'}/api/wasender/webhook`
            });
            
            const sessionData = wasenderSession.data || wasenderSession;
            const newNumericId = String(sessionData.id); 
            const sessionApiKey = sessionData.api_key || '';
            const webhookSecret = sessionData.webhook_secret || '';

            // Salvar segredos
            await supabase.from('channel_secrets').upsert({
                channel_id,
                user_id: user.id,
                session_api_key: sessionApiKey,
                webhook_secret: webhookSecret
            }, { onConflict: 'channel_id' });

            // Atualizar canal
            const configUpdate = {
                ...channel.config,
                wasender_session_id: newNumericId,
                wasender_status: 'need_scan',
                phoneNumber: e164Phone,
            };

            await supabase.from('channels').update({ config: configUpdate }).eq('id', channel_id);
            wasenderId = newNumericId;

            console.log(`[SESSION-SHIM] Canal ${channel_id} reparado com sucesso. ID Wasender: ${wasenderId}`);
        } catch (createErr: any) {
            console.error('[SESSION-SHIM] Falha ao criar sessão de reparo:', createErr.message);
            
            // Tratar conflito de número
            if (createErr.message.includes('already been taken') || createErr.message.includes('422')) {
                return NextResponse.json({ 
                    success: false, 
                    error: 'Este número já possui uma sessão ativa na Wasender.', 
                    reason: 'PHONE_CONFLICT' 
                }, { status: 409 });
            }

            return NextResponse.json({ 
                success: false, 
                error: 'Falha ao criar sessão na Wasender durante reparo.', 
                details: createErr.message 
            }, { status: 502 });
        }
    } else if (!wasenderId) {
      console.warn(`[SESSION-SHIM] Canal legado detectado (ID ausente): ${channel_id}`);
      return NextResponse.json({ 
        success: false, 
        error: 'Este canal é legado e precisa ser recriado.', 
        reason: 'LEGACY_CHANNEL_RECONFIG_NEEDED' 
      }, { status: 422 });
    }

    // 3. Tentar conectar a sessão REAL (ID Numérico)
    try {
      console.log(`[SESSION-SHIM] Conectando sessão real ${wasenderId}...`);
      const connectRes = await WasenderClient.connectSession(wasenderId);
      const connectData = connectRes.data || connectRes;
      
      const remoteStatus = (connectData.status || '').toUpperCase();
      let localStatus = 'unknown';

      if (remoteStatus.includes('CONNECTED')) {
        localStatus = 'connected';
      } else if (remoteStatus.includes('QR') || remoteStatus.includes('SCAN') || remoteStatus.includes('PENDING') || remoteStatus === 'NEED_SCAN') {
        localStatus = 'need_scan';
      } else {
        localStatus = 'disconnected';
      }

      // Extrair QR se veio no connect
      const qrCode = connectData.qrCode || connectData.qrcode || connectData.qr || null;

      const newConfig = { ...channel.config, wasender_status: localStatus };
      await supabase.from('channels').update({ config: newConfig }).eq('id', channel_id);

      return NextResponse.json({ 
        success: true, 
        sessionId: wasenderId, 
        status: localStatus,
        qrcode: qrCode 
      });
    } catch (connectError: any) {
      console.error('[SESSION-SHIM] Falha no connect real:', connectError.message);
      return NextResponse.json({ 
        success: false, 
        error: 'Erro ao conectar à sessão remota. A sessão pode ter sido excluída externamente.', 
        details: connectError.message 
      }, { status: 502 });
    }
  } catch (error: any) {
    console.error('Wasender Session POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const channel_id = searchParams.get('channel_id');

    if (!channel_id) return NextResponse.json({ error: 'channel_id required' }, { status: 400 });

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: channel } = await supabase
      .from('channels')
      .select('config')
      .eq('id', channel_id)
      .eq('user_id', user.id)
      .single();

    if (!channel?.config?.wasender_session_id && !channel?.config?.sessionId) {
       return NextResponse.json({ error: 'Session not initialized' }, { status: 404 });
    }

    const wasenderId = channel.config.wasender_session_id || channel.config.sessionId;

    // 2. Checar status realtime (GET Status usa API Key)
    const { data: secrets } = await supabase.from('channel_secrets').select('session_api_key').eq('channel_id', channel_id).single();
    
    let realStatus = 'unknown';
    try {
        const wasenderResponse = await WasenderClient.getStatus(wasenderId, secrets?.session_api_key);
        const sessionData = wasenderResponse.data || wasenderResponse;
        const remoteStatus = (sessionData.status || '').toUpperCase();
        
        if (remoteStatus.includes('CONNECTED')) realStatus = 'connected';
        else if (remoteStatus.includes('QR') || remoteStatus.includes('SCAN') || remoteStatus.includes('PENDING')) realStatus = 'need_scan';
        else if (remoteStatus.includes('DISCONNECTED')) realStatus = 'disconnected';
        else realStatus = 'logged_out';

    } catch (e) {
        realStatus = 'sync_failed';
    }

    // 3. Atualizar o banco de dados se o status mudou
    if (channel.config.wasender_status !== realStatus) {
        const newConfig = { ...channel.config, wasender_status: realStatus };
        await supabase.from('channels').update({ config: newConfig }).eq('id', channel_id);
    }

    return NextResponse.json({ status: realStatus });

  } catch (error: any) {
    console.error('Wasender Session GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
