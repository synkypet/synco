import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/access/require-operational-access';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveShopeeCapturedContent } from '@/lib/shopee-content-resolver';
import { parseShopeeContentBlocks } from '@/lib/shopee-content-resolver/parser';

/**
 * POST /api/shopee/discovered-coupons/manual-validate
 *
 * Valida até 5 links/textos manualmente.
 * - Usa resolveShopeeCapturedContent (Layer 1 + 2)
 * - Salva cupons verificados em public.discovered_coupons
 * - Salva promo landings em public.discovered_promo_pages
 * - NUNCA salva produtos em áreas de cupom
 * - NÃO gera link afiliado
 * - NÃO chama ShopeeAdapter para reafiliação
 */
export async function POST(request: Request) {
  const gate = await requireAuthenticatedUser();
  if (!gate.ok) return gate.response;
  const { user } = gate;
  const adminClient = createAdminClient();

  try {
    const body = await request.json();
    const { items: rawItems, rawText } = body;

    let items: string[] = [];

    if (rawText && typeof rawText === 'string') {
      console.log(`[MANUAL-VALIDATE] rawText mode: true`);
      items = parseShopeeContentBlocks(rawText);
      console.log(`[MANUAL-VALIDATE] parsed_blocks: ${items.length}`);
    } else if (Array.isArray(rawItems)) {
      items = rawItems;
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'Nenhum conteúdo detectado para validar.' }, { status: 400 });
    }

    // Limite de 5 itens para segurança (pode ser ajustado se necessário)
    if (items.length > 5) {
      console.warn(`[MANUAL-VALIDATE] ⚠️ Reduzindo de ${items.length} para 5 itens (limite de segurança).`);
      items = items.slice(0, 5);
    }

    const results: any[] = [];
    const errors: any[] = [];

    console.log('\n' + '═'.repeat(60));
    console.log(`[MANUAL-VALIDATE] ▶ Nova requisição (MODO ANÁLISE)`);
    console.log(`[MANUAL-VALIDATE] user_id: ${user.id}`);
    console.log(`[MANUAL-VALIDATE] itens a analisar: ${items.length}`);
    console.log('═'.repeat(60));

    for (const text of items) {
      if (typeof text !== 'string' || !text.trim()) continue;

      let result;
      try {
        console.log(`\n[MANUAL-VALIDATE] ─── Item Analisado ─────────────────`);
        console.log(`[MANUAL-VALIDATE] input preview:     ${text.substring(0, 150).replace(/\n/g, ' ')}...`);
        
        result = await resolveShopeeCapturedContent({ text: text.trim(), force_deep_audit: true });
        
        console.log(`[MANUAL-VALIDATE] content_type:      ${result.content_type}`);
        console.log(`[MANUAL-VALIDATE] accepted_target:   ${result.accepted_target}`);
        console.log(`[MANUAL-VALIDATE] coupon_code:       ${result.coupon_code || '(nenhum)'}`);
        console.log(`[MANUAL-VALIDATE] resolved_url:      ${result.resolved_url || '(nenhuma)'}`);
        console.log(`[MANUAL-VALIDATE] ─── FIM ANÁLISE ───────────────────`);
      } catch (err: any) {
        console.error(`[MANUAL-VALIDATE] ❌ ERRO na resolução: ${err.message}`);
        errors.push({ input: text.substring(0, 60), error: err.message });
        continue;
      }

      results.push({
        rawText: text,
        input_preview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        content_type: result.content_type,
        accepted_target: result.accepted_target,
        confidence: result.confidence,
        coupon_code: result.coupon_code,
        original_url: result.original_url,
        resolved_url: result.resolved_url,
        canonical_url: result.canonical_url,
        validation_depth: result.validation_depth,
        reasons: result.reasons,
        debug: result.debug
      });
    }

    console.log('\n' + '═'.repeat(60));
    console.log(`[MANUAL-VALIDATE] ◀ Resumo da Análise`);
    console.log(`[MANUAL-VALIDATE] total:             ${results.length}`);
    console.log(`[MANUAL-VALIDATE] ⚠️  errors:            ${errors.length}`);
    console.log(`[MANUAL-VALIDATE] ℹ️  SALVAMENTO:        NÃO (Modo Fase B)`);
    console.log('═'.repeat(60) + '\n');

    return NextResponse.json({
      results,
      errors
    });

  } catch (error: any) {
    console.error('[MANUAL-VALIDATE] Erro crítico:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
