import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
    return NextResponse.json({ 
        status: 'online', 
        message: 'SYNCO Wasender Webhook Receiver is ready',
        timestamp: new Date().toISOString()
    });
}

export async function POST(request: Request) {
    const logPrefix = `[WEBHOOK-WASENDER] [${new Date().toISOString()}]`;
    const signature = request.headers.get('x-webhook-signature');
    const webhookSecret = process.env.WASENDER_WEBHOOK_SECRET;

    // 1. Validação de Segurança (Assinatura)
    if (webhookSecret) {
        if (!signature || signature !== webhookSecret) {
            console.warn(`${logPrefix} ❌ ASSINATURA INVÁLIDA: ${signature || 'MISSING'}`);
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }
        console.log(`${logPrefix} ✅ ASSINATURA VÁLIDA`);
    }

    try {
        const body = await request.json();
        const event = body.event || body.type;
        const sessionId = String(body.sessionId || body.session_id || body.data?.sessionId);
        const hasData = !!body.data;

        console.log(`${logPrefix} Evento recebido: ${event} | Session: ${sessionId}`);

        // 2. Processamento de Status de Sessão
        if (event === 'session.status' || event === 'session_status') {
            const rawStatus = body.status || body.data?.status;
            
            if (rawStatus && sessionId) {
                console.log(`${logPrefix} Atualizando status da sessão ${sessionId} para: ${rawStatus}`);
                
                const supabase = createAdminClient();
                
                // Buscar canal pela sessionId dentro do jsonb config
                const { data: channels, error: fetchErr } = await supabase
                    .from('channels')
                    .select('id, config')
                    .filter('config->>sessionId', 'eq', sessionId);

                if (fetchErr) {
                    console.error(`${logPrefix} Erro ao buscar canal para webhook:`, fetchErr.message);
                } else if (channels && channels.length > 0) {
                    for (const channel of channels) {
                        const updatedConfig = {
                            ...channel.config,
                            wasender_status: rawStatus,
                            last_status_update: new Date().toISOString()
                        };

                        const { error: updateErr } = await supabase
                            .from('channels')
                            .update({ config: updatedConfig })
                            .eq('id', channel.id);

                        if (updateErr) {
                            console.error(`${logPrefix} Erro ao atualizar status do canal ${channel.id}:`, updateErr.message);
                        } else {
                            console.log(`${logPrefix} ✅ Canal ${channel.id} atualizado para ${rawStatus}`);
                        }
                    }
                } else {
                    console.warn(`${logPrefix} Nenhum canal encontrado para sessionId: ${sessionId}`);
                }
            }
        }

        // 3. Processamento de Grupos (Placeholder para futura malha profunda automática)
        // if (event === 'groups.upsert' || event === 'groups.update') { ... }

        return NextResponse.json({ 
            success: true, 
            received: true,
            event 
        }, { status: 200 });

    } catch (error: any) {
        console.error(`${logPrefix} Falha ao processar payload:`, error.message);
        
        // Mesmo em erro de parsing, retornamos 200 ou 400 dependendo da política de retry do Wasender.
        // Por segurança no MVP, retornamos 400 para debug, mas 200 seria aceitável para silenciar retries inúteis.
        return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
    }
}
