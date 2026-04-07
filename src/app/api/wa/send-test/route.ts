import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WasenderClient } from '@/lib/wasender/client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { channelId, phone, message } = await request.json();

    if (!channelId || !phone || !message) {
      return NextResponse.json({ error: 'Campos obrigatórios: channelId, phone, message' }, { status: 400 });
    }

    // 1. Buscar a configuração do canal
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('config')
      .eq('id', channelId)
      .eq('user_id', session.user.id)
      .single();

    if (channelError || !channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    const sessionId = channel.config?.sessionId;
    if (!sessionId) {
      return NextResponse.json({ error: 'Channel not connected (missing sessionId)' }, { status: 400 });
    }

    // Formata o número (Wasender exige '@c.us' para DMs e números limpos)
    let formattedPhone = phone.replace(/[^\d@.us]/g, ''); // remove + e espaços, mantém partes do c.us
    if (!formattedPhone.includes('@')) {
      formattedPhone = `${formattedPhone}@c.us`;
    }

    console.log(`[TEST-SEND] Disparando de sessionId: ${sessionId} para: ${formattedPhone}`);
    
    // 2. Disparar direto no Wasender
    const response = await WasenderClient.sendMessage(sessionId, formattedPhone, message);

    console.log(`[TEST-SEND] Sucesso:`, response);
    return NextResponse.json({ success: true, response });

  } catch (error: any) {
    console.error('Test Send Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
