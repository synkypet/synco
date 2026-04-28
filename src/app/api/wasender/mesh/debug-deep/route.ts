import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WasenderClient } from '@/lib/wasender/client';

export async function GET() {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const supabase = createClient();
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Pegar carona no grupo que sabemos que existe
    const { data: group } = await supabase
      .from('groups')
      .select('id, remote_id, channel_id, channels(config)')
      .not('remote_id', 'is', null)
      .limit(1)
      .single();

    if (!group) return NextResponse.json({ error: 'Nenhum grupo com remote_id encontrado' });

    const channel_id = group.channel_id;
    const remote_id = group.remote_id;
    const sessionId = (group.channels as any)?.config?.sessionId;

    // 2. Buscar Secret
    const { data: secrets } = await supabase
      .from('channel_secrets')
      .select('session_api_key')
      .eq('channel_id', channel_id)
      .single();

    const apiKey = secrets?.session_api_key;

    // 3. Testar Wasender API
    console.log(`[DEBUG-DEEP] Testando para Session: ${sessionId}, Group: ${remote_id}. API Key: ${apiKey ? 'SESSION' : 'FALLBACK'}`);
    
    let participantsRes;
    try {
      participantsRes = await WasenderClient.getGroupParticipants(sessionId, remote_id, apiKey);
    } catch (e: any) {
      return NextResponse.json({ phase: 'fetch_failed', error: e.message });
    }

    const participants = participantsRes.data || participantsRes.participants || participantsRes;
    
    if (!Array.isArray(participants)) {
      return NextResponse.json({ 
        phase: 'invalid_format', 
        raw: participantsRes 
      });
    }

    // 4. Analisar Roles
    const sample = participants[0] || null;
    const rolesIdentified = participants.map((p: any) => ({
      jid: p.id || p.jid || p.remote_id,
      is_admin: !!(p.admin || p.isAdmin || p.role === 'admin' || p.is_admin),
      raw_role: p.role,
      raw_admin_flag: p.admin || p.isAdmin
    })).slice(0, 10);

    return NextResponse.json({
      success: true,
      sessionId,
      remote_id,
      total_participants: participants.length,
      sample_keys: sample ? Object.keys(sample) : [],
      sample_data: sample,
      analysis: rolesIdentified
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
