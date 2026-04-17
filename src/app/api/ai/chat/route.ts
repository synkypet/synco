import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { processLinks } from '@/lib/linkProcessor';

// Precisaremos acessar o Supabase para pegar as chaves do afiliado, se existir. 
// Para este chat, podemos ter user/session, mas temporariamente chamaremos "processLinks" com array vazio de conexões caso não tenha.
// Idealmente extrai o header Auth ou session Supabase. Mas para FASE 1, array vazio vai cair pro fallback (preço API).

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // O SDK no seu servidor não possui o 'convertToCoreMessages' exportado, então vamos mapear estritamente
    // apenas os campos que o Gemini aceita (role, content).
    const coreMessages = messages.map((m: any) => {
      let content = '';

      if (m.parts && Array.isArray(m.parts)) {
        content = m.parts
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('');
      } else if (typeof m.content === 'string') {
        content = m.content;
      }

      if (m.role === 'assistant') {
        const coreMsg: any = { role: 'assistant', content: content || '' };
        // Mapear retrospectiva de tools se a interface reenviar
        if (m.toolInvocations) {
          coreMsg.toolCalls = m.toolInvocations.map((t: any) => ({
            type: 'tool-call',
            toolCallId: t.toolCallId,
            toolName: t.toolName,
            args: t.args,
          }));
        }
        return coreMsg;
      }

      if (m.role === 'tool') {
        return {
          role: 'tool',
          content: m.toolInvocations ? m.toolInvocations.map((t: any) => ({
            type: 'tool-result',
            toolCallId: t.toolCallId,
            toolName: t.toolName,
            result: t.result,
          })) : []
        };
      }

      return { role: m.role || 'user', content: content || '' };
    });

    // O Gemini rejeita o payload se a primeira mensagem não for do "user" (regra de histórico).
    while (coreMessages.length > 0 && coreMessages[0].role === 'assistant') {
      coreMessages.shift();
    }

    // 1. DIRECT INJECTION: Extrair as URLs da última mensagem do usuário (se existir)
    const lastMessage = coreMessages[coreMessages.length - 1];
    let factualDataString = "";

    if (lastMessage && lastMessage.role === 'user') {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urlsFound = lastMessage.content.match(urlRegex) || [];

      if (urlsFound.length > 0) {
        // Tentar buscar os dados factuais do produto enviando a(s) url(s) para o processador local
        try {
          // Processador assíncrono para os URLs da mensagem
          const results = await processLinks(urlsFound, [], 'auto');
          if (results && results.length > 0) {
            factualDataString = results.map((r: any) => {
              const snap = r.factual ? r.factual : r;
              return `Produto: ${snap.title || 'Desconhecido'}
Preço Base: ${snap.priceFormatted || snap.originalPriceFormatted || 'N/A'}
Estimativa Pix Factual: ${snap.estimatedPixPriceFormatted || 'N/A'}
Comissão Factual %/R$: ${snap.commissionValueFormatted || snap.commissionRatePercent || 'N/A'}`;
            }).join('\\n---\\n');
          }
        } catch (e) {
          console.error('[AI] Erro ao extrair link para Injeção Direta:', e);
        }
      }
    }

    let finalSystemPrompt = `Você é o SYNCO Intelligence, o Cérebro Analítico da plataforma SYNCO (um SaaS de distribuição em massa pro WhatsApp).
      
ENTENDIMENTO DO SISTEMA SYNCO:
1. O usuário NÃO precisa converter o link. O sistema SYNCO automaticamente pega o link original de qualquer Produto e converte para link de Afiliado na hora de enviar pro WhatsApp. 
2. Seu papel é APENAS analisar o produto para criar o TEXTO PERSUASIVO da oferta. 

REGRAS DE CONDUTA E ESTÉTICA:
1. Se foi fornecido algum "DADO FACTUAL DIRETO" pelo sistema (logo abaixo), você MUST usá-lo para montar a copy; não invente preços ou dados genéricos. O sistema ocultamente consultou a API da Loja.
2. Escreva uma copy persuasiva muito agressiva para WhatsApp (cerca de 5 a 6 linhas no máximo), voltada a gatilhos mentais.
3. DESTAQUE o Preço Factual (ou Heurística Pix) retornado pela injeção direta usando Emojis (🔥). O preço é o maior hook.
4. NUNCA diga para o usuário "vou converter o seu link" nem ensine como gerar link. Apenas devolva a Copy perfeita.`;

    if (factualDataString) {
      finalSystemPrompt += `\\n\\n[DADOS FACTUAIS INJETADOS PELO SISTEMA INVISÍVEL (USE-OS OBRIGATORIAMENTE PARA A OFERTA)]:\\n${factualDataString}`;
    }

    const result = await streamText({
      model: google('gemini-flash-latest'),
      system: finalSystemPrompt,
      messages: coreMessages,
    });

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error("Erro no Gemini:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
