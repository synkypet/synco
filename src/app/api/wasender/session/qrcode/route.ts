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

    // 1. Pegar a sessionId do canal
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

    // 2. Tentar buscar QR Code do endpoint dedicado
    try {
      const qrData = await WasenderClient.getQrCode(sessionId);
      const responseData = qrData.data || qrData;
      
      // A API pode retornar em diferentes formatos: qrCode, qrcode, qr, base64
      const payload = responseData.qrCode || responseData.qrcode || responseData.qr || responseData.base64 || null;

      if (payload) {
        return NextResponse.json({ qrcode: payload });
      }
    } catch (qrError: any) {
      console.log('QR endpoint failed, trying connect endpoint:', qrError.message);
    }

    // 3. Fallback: chamar connect que também retorna o QR Code
    try {
      const connectData = await WasenderClient.connectSession(sessionId);
      const connectResponse = connectData.data || connectData;
      const qrFromConnect = connectResponse.qrCode || connectResponse.qrcode || connectResponse.qr || null;

      if (qrFromConnect) {
        return NextResponse.json({ qrcode: qrFromConnect });
      }
    } catch (connectError: any) {
      console.log('Connect endpoint also failed:', connectError.message);
    }

    return NextResponse.json({ error: 'QR Code not available. A sessão pode precisar de mais tempo para inicializar.' }, { status: 404 });

  } catch (error: any) {
    console.error('Wasender Session QRCode GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
