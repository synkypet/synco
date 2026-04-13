
import { createClient } from '@/lib/supabase/server';
import { WasenderClient } from '@/lib/wasender/client';
import { NextResponse } from 'next/server';

/**
 * POST /api/wasender/channels
 * Criação transacional de canal: Wasender Session -> Supabase Channel -> channel_secrets
 */
export async function POST(request: Request) {
  const logPrefix = `[CHANNEL-CREATE] [${new Date().toISOString()}]`;
  const supabase = createClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    console.log(`${logPrefix} Payload recebido:`, JSON.stringify(body));

    const { name, type, description, phoneNumber } = body;

    // 1. Validação e Normalização
    if (!name || !type) {
       return NextResponse.json({ error: 'Campos obrigatórios ausentes (name, type)', reason: 'INVALID_INPUT' }, { status: 400 });
    }

    if (type !== 'whatsapp') {
       // Por enquanto o ciclo de vida transacional é focado em WhatsApp (Wasender)
       return NextResponse.json({ error: 'Tipo de canal não suportado para criação transacional via Wasender' }, { status: 400 });
    }

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Telefone é obrigatório para canais WhatsApp', reason: 'MISSING_PHONE' }, { status: 400 });
    }

    // Normalização: Formato E.164 (ex: +5519989635089)
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    const finalPhone = `+${digitsOnly}`;
    
    if (digitsOnly.length < 10) {
      return NextResponse.json({ error: 'Número de telefone inválido ou incompleto', reason: 'INVALID_PHONE' }, { status: 400 });
    }

    console.log(`${logPrefix} Auditoria Telefone:`);
    console.log(`  - Bruto: ${phoneNumber}`);
    console.log(`  - Interno: ${digitsOnly}`);
    console.log(`  - Final (E.164): ${finalPhone}`);

    const sessionId = `synco_${Math.random().toString(36).substring(7)}_${Date.now()}`;
    console.log(`${logPrefix} Gerando sessionId local: ${sessionId}`);

    // 2. Criar sessão na Wasender (Transactional Step)
    let sessionApiKey = '';
    let wasenderNumericId = '';

    try {
      console.log(`${logPrefix} Chamando WasenderClient.createSession...`);
      const wasenderRes = await WasenderClient.createSession({
        name: `SYNCO - ${name}`,
        phoneNumber: finalPhone,
        webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://synco-mocha.vercel.app'}/api/wasender/webhook`
      });
      console.log(`${logPrefix} Resposta Wasender:`, JSON.stringify(wasenderRes));

      const sessionData = wasenderRes.data || wasenderRes;
      const success = wasenderRes.success || !!sessionData.id;

      if (!success) {
        throw new Error(wasenderRes.message || 'Wasender failed to create session');
      }
      
      wasenderNumericId = String(sessionData.id);
      sessionApiKey = sessionData.api_key || '';
      
      console.log(`${logPrefix} Sessão Remota Criada: ID=${wasenderNumericId}`);
    } catch (err: any) {
      console.error(`${logPrefix} ERRO WASENDER:`, err.message);
      
      // Tratamento de Conflito (Número já em uso)
      if (err.message.includes('already been taken') || err.message.includes('422')) {
        return NextResponse.json({ 
          success: false, 
          error: 'Este número já possui uma sessão ativa na Wasender.', 
          reason: 'PHONE_CONFLICT' 
        }, { status: 409 });
      }

      return NextResponse.json({ 
        success: false, 
        error: 'Falha ao criar sessão remota na Wasender', 
        details: err.message 
      }, { status: 502 });
    }

    // 3. Persistir no Supabase
    console.log(`${logPrefix} Persistindo canal no Supabase...`);
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .insert({
        name,
        type,
        user_id: user.id,
        description,
        is_active: true,
        config: {
          sessionId, // Identificador Local (Legado/Referência)
          wasender_session_id: wasenderNumericId, // Identificador Real Wasender
          phoneNumber: finalPhone,
          status: 'need_scan',
          wasender_status: 'need_scan'
        }
      })
      .select()
      .single();

    if (channelError) {
      console.error(`${logPrefix} Falha ao persistir canal no DB. Executando ROLLBACK na Wasender...`);
      // Rollback remoto usando o ID NUMÉRICO
      await WasenderClient.deleteSession(wasenderNumericId)
        .then(() => console.log(`${logPrefix} ROLLBACK: Sessão remota ${wasenderNumericId} excluída.`))
        .catch(e => console.error(`${logPrefix} ROLLBACK FAILED:`, e.message));
      
      return NextResponse.json({ 
        success: false, 
        error: 'Erro de banco de dados ao salvar canal local', 
        details: channelError.message 
      }, { status: 500 });
    }

    // 4. Salvar Segredos
    if (sessionApiKey) {
        const { error: secretError } = await supabase
            .from('channel_secrets')
            .upsert({
                channel_id: channel.id,
                user_id: user.id,
                session_api_key: sessionApiKey,
                updated_at: new Date().toISOString()
            }, { onConflict: 'channel_id' });
            
        if (secretError) {
            console.warn(`${logPrefix} Aviso: Falha ao salvar session_api_key.`);
        }
    }

    // 5. Trigger Inicial de Conexão (Opcional mas recomendado)
    try {
      await WasenderClient.connectSession(wasenderNumericId);
      console.log(`${logPrefix} Sessão ${wasenderNumericId} inicializada (Connect triggered).`);
    } catch (e: any) {
      console.warn(`${logPrefix} Alerta: Connect imediato falhou, mas a sessão foi criada.`);
    }

    console.log(`${logPrefix} ✅ Canal ${channel.id} criado com sucesso.`);

    return NextResponse.json({
        success: true,
        channel_id: channel.id,
        wasender_id: wasenderNumericId,
        message: 'Canal e sessão criados com sucesso'
    }, { status: 201 });

  } catch (error: any) {
    console.error(`${logPrefix} Erro inesperado:`, error.message);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
