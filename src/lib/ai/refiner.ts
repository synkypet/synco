// src/lib/ai/refiner.ts
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { OFFER_REFINER_PROMPT } from './prompts';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});

export interface RefineInput {
  productName: string;
  price?: string | null;
  originalPrice?: string | null;
  pixPrice?: string | null;
  installments?: string | null;
  link: string;
  highlights?: string[];
}

/**
 * Refina a copy de uma oferta usando Gemini.
 * Possui fallback determinístico se a IA falhar.
 */
export async function refineOfferCopy(input: RefineInput): Promise<string> {
  // 1. Validar se temos API Key
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.warn('[AI-REFINER] GOOGLE_GENERATIVE_AI_API_KEY não encontrada. Usando fallback.');
    return buildFallbackCopy(input);
  }

  try {
    const promptData = `
Produto: ${input.productName}
Preço Atual: ${input.price || 'Não informado'}
Preço Original: ${input.originalPrice || ''}
Preço Pix: ${input.pixPrice || ''}
Parcelamento: ${input.installments || ''}
Link: ${input.link}
Destaques: ${input.highlights?.join(', ') || 'Nenhum'}
    `.trim();

    const { text } = await generateText({
      model: google('gemini-flash-latest'),
      system: OFFER_REFINER_PROMPT,
      prompt: promptData,
    });

    if (!text || text.trim().length === 0) {
      throw new Error('IA retornou texto vazio');
    }

    return text.trim();

  } catch (error) {
    console.error('[AI-REFINER] Erro ao refinar com IA:', error);
    return buildFallbackCopy(input);
  }
}

/**
 * Construtor determinístico de fallback (Garante que a oferta saia mesmo sem IA)
 */
function buildFallbackCopy(input: RefineInput): string {
  const generic = `Oportunidade para garantir seu produto! Confira os detalhes dessa oferta.`;
  
  if (!input.productName) return generic;
  
  // Tenta algo ligeiramente melhor baseado no título
  const title = input.productName.trim();
  const blurb = `Confira essa oferta especial de ${title.substring(0, 50)}${title.length > 50 ? '...' : ''}. Garanta o seu antes que acabe!`;
  
  // Garante limite de 120 chars e 2 linhas (heurística)
  return blurb.substring(0, 120);
}
