import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TelegramClient } from '@/lib/telegram/client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { channelId, botToken } = await request.json();

    if (!channelId || !botToken) {
      return NextResponse.json({ error: 'Campos obrigatórios: channelId e botToken' }, { status: 400 });
    }

    // 1. Validar Token na API do Telegram
    let botInfo;
    try {
      const response = await TelegramClient.getMe(botToken);
      botInfo = response.result;
    } catch (e: any) {
      return NextResponse.json({ error: `Token inválido: ${e.message}` }, { status: 400 });
    }

    // 2. Salvar Token em channel_secrets
    const { error: secretsError } = await supabase
      .from('channel_secrets')
      .upsert({
        channel_id: channelId,
        user_id: session.user.id,
        session_api_key: botToken, // Usaremos a mesma coluna de api_key pro bot token pra não criar outra migração desnecessária no MVP
      });

    if (secretsError) {
      throw new Error(`Failed to save secrets: ${secretsError.message}`);
    }

    // 3. Atualizar config do canal informando o status
    const { data: channel } = await supabase
      .from('channels')
      .select('config')
      .eq('id', channelId)
      .single();

    const newConfig = { 
      ...(channel?.config || {}), 
      status: 'connected',
      bot_username: botInfo.username,
      bot_id: botInfo.id,
      bot_name: botInfo.first_name,
    };

    const { error: updateError } = await supabase
      .from('channels')
      .update({ config: newConfig })
      .eq('id', channelId);

    if (updateError) {
      throw new Error(`Failed to update channel config: ${updateError.message}`);
    }

    // 4. Registrar webhook automaticamente para auto-discovery de grupos
    let webhookRegistered = false;
    try {
      const host = request.headers.get('host');
      const protocol = host?.includes('localhost') ? 'http' : 'https';
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || (host ? `${protocol}://${host}` : null);
      
      if (appUrl) {
        const webhookUrl = `${appUrl}/api/telegram/webhook`;
        const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
        await TelegramClient.setWebhook(botToken, webhookUrl, webhookSecret);
        webhookRegistered = true;
        console.log(`[TG-CONNECT] Webhook registrado: ${webhookUrl}`);
      }
    } catch (webhookErr: any) {
      // Não bloquear a conexão se o webhook falhar (pode ser localhost)
      console.warn(`[TG-CONNECT] Webhook não registrado (ambiente local?): ${webhookErr.message}`);
    }

    return NextResponse.json({
      success: true,
      bot: {
        id: botInfo.id,
        username: botInfo.username,
        name: botInfo.first_name
      },
      webhookRegistered,
    });

  } catch (error: any) {
    console.error('Telegram Connect Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
