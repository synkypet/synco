import { NextResponse } from 'next/server';

/**
 * Webhook Wasender - SYNCO
 * Rota para recebimento de eventos globais de sessões
 * Documentação Esperada: 
 * https://synco-mocha.vercel.app/api/wasender/webhook
 */

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

    try {
        const body = await request.json();
        
        // Extração de campos core recomendados
        const event = body.event || body.type;
        const sessionId = body.sessionId || body.session_id || body.data?.sessionId;
        const hasData = !!body.data;

        console.log(`${logPrefix} Evento recebido: ${event}`);
        console.log(`${logPrefix} Session: ${sessionId}`);
        console.log(`${logPrefix} Has Data: ${hasData}`);
        console.log(`${logPrefix} Signature: ${signature ? 'PRESENT' : 'MISSING'}`);

        // TODO: Futura validação de assinatura e lógica de negócio (upsert groups/participants)
        // No momento, apenas acusar recebimento rápido para evitar timeouts no Wasender

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
