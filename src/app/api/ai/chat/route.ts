import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // SDK v6 envia mensagens no formato UIMessage com `parts` array.
    // O Gemini espera `role` + `content` (string).
    // Precisamos converter de parts → content string.
    const coreMessages = messages.map((m: any) => {
      let content = '';

      // v6: extrair texto de parts
      if (m.parts && Array.isArray(m.parts)) {
        content = m.parts
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('');
      }
      // Fallback: usar content diretamente (mensagens legadas)
      else if (typeof m.content === 'string') {
        content = m.content;
      }

      return { role: m.role, content };
    });

    // O Gemini rejeita o payload se a primeira mensagem não for do "user".
    while (coreMessages.length > 0 && coreMessages[0].role === 'assistant') {
      coreMessages.shift();
    }

    // Filtrar mensagens vazias que possam ter passado
    const validMessages = coreMessages.filter((m: any) => m.content.trim().length > 0);

    if (validMessages.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhuma mensagem válida recebida' }), {
        status: 400,
      });
    }

    const result = await streamText({
      model: google('gemini-flash-latest'),
      system: `Você é o SYNCO Intelligence, um assistente especializado em marketing de afiliados, copy persuasiva e geração de ofertas curtas e de alto impacto para WhatsApp. 
      
REGRAS:
1. Você só gera, revisa ou melhora textos. Não prometa interações técnicas com o sistema de agendamento ou navegação.
2. Seja direto e objetivo, sem cerimônias.
3. Use gatilhos mentais de urgência, escassez e exclusividade.
4. Utilize Emojis estrategicamente.
5. Quando pedirem um texto, já devolva a cópia pronta, não fique "preparando" o usuário.`,
      messages: validMessages,
    });

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error("Erro no Gemini:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
