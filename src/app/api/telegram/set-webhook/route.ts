// src/app/api/telegram/set-webhook/route.ts
// Registra o webhook do Telegram apontando para a URL pública do SYNCO.
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

    const { channelId } = await request.json();

    if (!channelId) {
      return NextResponse.json({ error: 'channelId é obrigatório' }, { status: 400 });
    }

    // Buscar bot token
    const { data: secretData } = await supabase
      .from('channel_secrets')
      .select('session_api_key')
      .eq('channel_id', channelId)
      .eq('user_id', session.user.id)
      .single();

    if (!secretData?.session_api_key) {
      return NextResponse.json({ error: 'Bot Token não encontrado. Conecte o bot primeiro.' }, { status: 400 });
    }

    // Montar URL do webhook
    const host = request.headers.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (host ? `${protocol}://${host}` : null);

    const webhookUrl = `${appUrl}/api/telegram/webhook`;
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    // Registrar no Telegram
    const result = await TelegramClient.setWebhook(
      secretData.session_api_key,
      webhookUrl,
      webhookSecret
    );

    return NextResponse.json({
      success: true,
      webhookUrl,
      result,
    });

  } catch (error: any) {
    console.error('Set Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
