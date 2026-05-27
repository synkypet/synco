import { NextResponse } from 'next/server';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { OFFER_HEADLINE_PROMPT } from '@/lib/ai/prompts';
import { createClient } from '@/lib/supabase/server';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});

function sanitizeHeadline(raw: string, fallback: string): string {
  let text = String(raw ?? '').split('\n')[0] ?? '';
  // Remover markdown bold/italic, aspas, backticks
  text = text.replace(/[*#"`']/g, '').trim();
  text = text.toUpperCase();

  if (!text || text.length < 6) return fallback;
  if (/https?:\/\//i.test(text)) return fallback;
  // Expressões de preço/desconto banidas (heurística extra)
  if (/R\$\s?\d/i.test(text)) return fallback;
  if (/CUPOM/i.test(text)) return fallback;

  // Limite de 70 caracteres cortando graciosamente
  if (text.length > 70) {
    text = text.slice(0, 70).trim();
  }

  return text;
}

export async function POST(req: Request) {
  let userId = 'unknown';
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    userId = user.id;

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.warn('[AI-HEADLINE] API Key ausente. Retornando erro amigável para fallback.');
      return NextResponse.json(
        { error: 'Chave de API do Gemini não configurada', source: 'fallback', headline: '' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const {
      productName,
      marketplace,
      category,
      originalPrice,
      currentPrice,
      discountPercent,
      instruction,
    } = body;

    if (!productName) {
      return NextResponse.json({ error: 'productName é obrigatório' }, { status: 400 });
    }

    // Montar contexto do prompt
    let contextData = `PRODUTO: ${productName}\n`;
    if (marketplace) contextData += `MARKETPLACE: ${marketplace}\n`;
    if (category) contextData += `CATEGORIA: ${category}\n`;
    if (originalPrice) contextData += `PREÇO ORIGINAL: ${originalPrice}\n`;
    if (currentPrice) contextData += `PREÇO ATUAL: ${currentPrice}\n`;
    if (discountPercent) contextData += `DESCONTO (%): ${discountPercent}\n`;
    
    if (instruction && instruction.trim() !== '') {
      contextData += `\nTEMA/INSTRUÇÃO DO USUÁRIO:\n"${instruction.trim()}"\n`;
    }

    const { text } = await generateText({
      model: google('gemini-flash-latest'),
      system: OFFER_HEADLINE_PROMPT,
      prompt: contextData,
      temperature: 0.8, // levemente criativo, mas focado
      maxRetries: 0,
    });

    const finalHeadline = sanitizeHeadline(text, '');

    if (!finalHeadline) {
      return NextResponse.json({
        headline: '',
        source: 'fallback',
        error: 'IA retornou formato inválido'
      });
    }

    return NextResponse.json({
      headline: finalHeadline,
      source: 'ai'
    });

  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    
    // Identificar erro de cota ou rate limit
    if (error?.statusCode === 429 || errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('Quota exceeded')) {
      console.info(`[AI-HEADLINE] quota_exhausted userIdPrefix=${userId.substring(0, 8)}`);
      return NextResponse.json(
        { headline: '', source: 'fallback', errorCode: 'quota_exhausted', message: 'IA indisponível no momento.' },
        { status: 200 }
      );
    }

    console.error('[AI-HEADLINE] Erro ao gerar headline:', errorMsg);
    return NextResponse.json(
      { error: 'Falha na geração com IA', details: errorMsg, source: 'fallback', headline: '' },
      { status: 500 }
    );
  }
}
