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

    const result = await streamText({
      model: google('gemini-flash-latest'),
      system: `Você é o SYNCO Intelligence, o Cérebro Analítico da plataforma SYNCO (um SaaS de distribuição em massa pro WhatsApp).
      
ENTENDIMENTO DO SISTEMA SYNCO:
1. O usuário NÃO precisa converter o link. O sistema SYNCO automaticamente pega o link original de qualquer Produto e converte para link de Afiliado na hora de enviar pro WhatsApp. 
2. Seu papel é APENAS analisar o produto para criar o TEXTO PERSUASIVO da oferta. 

REGRAS DE CONDUTA E ESTÉTICA:
1. Quando receber um link da Shopee, Mercado Livre, Amazon ou Magalu: SEMPRE e imediatamente chame a ferramenta "process_affiliate_link".
2. Depois que a ferramenta retornar o preço e os dados do produto, escreva uma copy persuasiva muito agressiva para WhatsApp (cerca de 5 a 6 linhas no máximo).
3. DESTAQUE o Preço Factual (ou Heurística Pix) retornado pela ferramenta usando Emojis (🔥). O preço é o maior hook.
4. NUNCA diga para o usuário "vou converter o seu link" nem ensine como gerar link. Apenas devolva a Copy perfeita.`,
      messages: coreMessages,
      tools: {
        process_affiliate_link: tool({
          description: 'Sempre chame esta função quando o usuário enviar a URL de um produto de Marketplace (Shopee, Mercado Livre, Magalu, Amazon). Esta ferramenta fará o scrape do valor atual, original, e gerará dados factuais para você montar a copy.',
          parameters: z.object({
            url: z.string().url().describe('A url exata que o usuário enviou'),
          }),
          // @ts-ignore
          execute: async ({ url }: { url: string }) => {
            console.log('[AI TOOL] Processing affiliate link:', url);
            try {
              // processLinks retorna um array ProductSnapshot. Vamos mandar o index 0
              const results = await processLinks([url], [], 'auto');
              if (results.length > 0) {
                 const snap = results[0].factual;
                 return {
                   success: true,
                   title: snap.title,
                   preco_atual: snap.priceFormatted,
                   preco_original: snap.originalPriceFormatted,
                   preco_pix_estimado: snap.estimatedPixPriceFormatted,
                   link_pronto: snap.finalLinkToSend,
                   comissao_estimada: snap.commissionValueFormatted,
                 }
              }
              return { success: false, reason: "Link não gerou resultado útil." };
            } catch (err:any) {
              return { success: false, error: err.message };
            }
          },
        }),
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error("Erro no Gemini:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
