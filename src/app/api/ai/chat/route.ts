import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // O Gemini é extremamente restrito com os campos extras injetados nativamente pelo useChat (como "id").
    // Além disso, a API do Gemini rejeita o payload inteiro (400 Bad Request) se a primeira mensagem histórica não for do "user".
    const coreMessages = messages.map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    // Remove a primeira mensagem se for um assistant, para evitar conflito com a engine do google.
    while (coreMessages.length > 0 && coreMessages[0].role === 'assistant') {
      coreMessages.shift();
    }

    const result = await streamText({
      model: google('gemini-2.0-flash'),
      system: `Você é o SYNCO Intelligence, um assistente especializado em marketing de afiliados, copy persuasiva e geração de ofertas curtas e de alto impacto para WhatsApp. 
      
REGRAS:
1. Você só gera, revisa ou melhora textos. Não prometa interações técnicas com o sistema de agendamento ou navegação.
2. Seja direto e objetivo, sem cerimônias.
3. Use gatilhos mentais de urgência, escassez e exclusividade.
4. Utilize Emojis estrategicamente.
5. Quando pedirem um texto, já devolva a cópia pronta, não fique "preparando" o usuário.`,
      messages: coreMessages,
    });

    if ((result as any).toUIMessageStreamResponse) {
      return (result as any).toUIMessageStreamResponse();
    } else if ((result as any).toDataStreamResponse) {
      return (result as any).toDataStreamResponse();
    } else if ((result as any).toTextStreamResponse) {
      return (result as any).toTextStreamResponse();
    }
    
    throw new Error("No valid stream response method found on result");
  } catch (error: any) {
    console.error("Erro no Gemini:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
