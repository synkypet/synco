import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const result = await streamText({
      model: google('models/gemini-1.5-pro-latest'),
      system: `Você é o SYNCO Intelligence, um assistente especializado em marketing de afiliados, copy persuasiva e geração de ofertas curtas e de alto impacto para WhatsApp. 
      
REGRAS:
1. Você só gera, revisa ou melhora textos. Não prometa interações técnicas com o sistema de agendamento ou navegação.
2. Seja direto e objetivo, sem cerimônias.
3. Use gatilhos mentais de urgência, escassez e exclusividade.
4. Utilize Emojis estrategicamente.
5. Quando pedirem um texto, já devolva a cópia pronta, não fique "preparando" o usuário.`,
      messages,
    });

    return (result as any).toDataStreamResponse ? (result as any).toDataStreamResponse() : (result as any).toTextStreamResponse();
  } catch (error: any) {
    console.error("Erro no Gemini:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
