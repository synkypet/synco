import { NextResponse } from 'next/server';
import { handleWasenderWebhook } from '@/lib/wasender/webhook-logic';

export async function GET() {
    return NextResponse.json({ 
        status: 'online', 
        message: 'SYNCO Wasender Legacy Endpoint is active (Direct Logic Mode)',
        timestamp: new Date().toISOString()
    });
}

/**
 * Endpoint legado que agora executa a lógica diretamente sem redirecionamento.
 * Isso elimina problemas de rede, DNS ou autenticação de proxy (401).
 */
export async function POST(request: Request) {
    const requestId = `LEGACY-${Math.random().toString(36).substring(7)}`;
    return handleWasenderWebhook(request, requestId);
}
