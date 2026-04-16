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
Link: ${input.link}
Destaques: ${input.highlights?.join(', ') || 'Nenhum'}
    `.trim();

    const { text } = await generateText({
      model: google('gemini-1.5-flash'),
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
  const lines = [
    `🛍️ *${input.productName.toUpperCase()}*`,
    '',
    input.originalPrice ? `De: ~~${input.originalPrice}~~` : '',
    input.price ? `🔥 *Por: ${input.price}*` : '',
    input.pixPrice ? `🎯 *No Pix: ${input.pixPrice}*` : '',
    '',
    '👉 *Compre aqui:*',
    input.link,
    '',
    '⚠️ Promoção sujeita a alteração a qualquer momento.'
  ].filter(l => l !== '');

  return lines.join('\n');
}
