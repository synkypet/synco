import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WasenderClient } from '@/lib/wasender/client';

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

    // 1. Validar e pegar a config do canal para extrair a sessionId
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

    // 2. Buscar o payload puro do QRCode na API Wasender
    const qrData = await WasenderClient.getQrCode(sessionId);
    
    // Assumimos que qrData contém um campo { qrcode: "..." } ou é diretamente a string, ou algo acessível
    const payload = qrData.qrcode || qrData.qr || qrData.base64 || null;

    if (!payload) {
      return NextResponse.json({ error: 'QR Code not available inside response', raw: qrData }, { status: 404 });
    }

    return NextResponse.json({ qrcode: payload });

  } catch (error: any) {
    console.error('Wasender Session QRCode GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
