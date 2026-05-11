-- Migration: 20260428195900_create_radar_discovered_products.sql
-- Description: Cria a tabela radar_discovered_products, que registra o vínculo
--              operacional entre produtos descobertos pelo Radar e suas fontes de automação.
--
-- ATENÇÃO: Esta migration foi reconstruída a partir da análise do código-fonte (inferência).
-- A tabela existia no banco sem migration de criação. Esta migration restaura a estrutura
-- com total compatibilidade com o código de produção.
--
-- Deve ser aplicada ANTES de:
-- 20260428210000_radar_activity_layer.sql (que altera esta tabela)
-- Timestamp escolhido: 20260428195900 (anterior ao 20260428210000)
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── Campos com CERTEZA ABSOLUTA (inferidos de inserts/selects/updates diretos) ────
--
-- product_id        → .upsert({ product_id: product.id ... }) + .in('product_id', chunk)
-- source_id         → .eq('source_id', s.id) + .upsert({ source_id: s.id ... })
-- user_id           → .upsert({ user_id: s.user_id ... })
-- stable_product_key→ .eq('stable_product_key', stableKey) + upsert + select(id, stable_product_key)
-- status            → .eq('status', 'pending') + update({ status: 'dispatched' / 'exhausted' / 'skipped' })
-- discovered_at     → .upsert({ discovered_at: ... }) + .gte('discovered_at', ...) + .order('discovered_at')
-- dispatched_at     → .update({ dispatched_at: new Date().toISOString() }) + .gte('dispatched_at', sevenDaysAgo)
-- campaign_id       → .update({ campaign_id: campaign.id }) + .not('campaign_id', 'is', null)
-- score             → .upsert({ score: finalScore ... })
-- skipped_reason    → .update({ skipped_reason: ... })
-- attempts          → .update({ attempts: 1 })
--
-- ─── Campos PROVÁVEIS (padrão do projeto, não referenciados diretamente) ─────
-- id                → pk padrão de todas as tabelas
-- created_at        → padrão de todas as tabelas
-- updated_at        → padrão de todas as tabelas (trigger)

CREATE TABLE IF NOT EXISTS public.radar_discovered_products (
    -- Identidade
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relacionamentos (CERTEZA ABSOLUTA - usados em queries e upserts)
    source_id   UUID NOT NULL REFERENCES public.automation_sources(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,

    -- Identificação Estável do Produto na Shopee (CERTEZA ABSOLUTA)
    -- Formato: 'shopee:{shopId}:{itemId}'
    stable_product_key TEXT,

    -- Estado Operacional (CERTEZA ABSOLUTA - todos os status usados no código)
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'dispatched', 'exhausted', 'skipped')),

    -- Scoring e Triagem (CERTEZA ABSOLUTA - inserido no upsert)
    score          NUMERIC,
    skipped_reason TEXT,
    attempts       INTEGER DEFAULT 0,

    -- Timestamps Operacionais (CERTEZA ABSOLUTA - lidos/escritos diretamente)
    discovered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    dispatched_at  TIMESTAMPTZ,

    -- Timestamps de Controle (padrão do projeto)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Unique Constraint (CERTEZA ABSOLUTA) ────────────────────────────────────
-- O código usa: .upsert({...}, { onConflict: 'product_id,source_id', ignoreDuplicates: true })
-- Isso exige um unique constraint (ou index) nessas duas colunas.
CREATE UNIQUE INDEX IF NOT EXISTS uq_rdp_product_source
    ON public.radar_discovered_products (product_id, source_id);

-- ─── Indexes de Performance (inferidos das queries de produção) ───────────────
-- Anti-fadiga: .eq('source_id').eq('stable_product_key').gte('dispatched_at')
CREATE INDEX IF NOT EXISTS idx_rdp_source_stable_key
    ON public.radar_discovered_products (source_id, stable_product_key);

-- Dispatcher principal: .eq('source_id').eq('status','pending').gte('discovered_at').order('discovered_at')
CREATE INDEX IF NOT EXISTS idx_rdp_source_status_discovered
    ON public.radar_discovered_products (source_id, status, discovered_at DESC);

-- Automação Service: .eq('source_id').in('product_id').not('campaign_id','is',null).order('discovered_at')
CREATE INDEX IF NOT EXISTS idx_rdp_source_product
    ON public.radar_discovered_products (source_id, product_id);

-- Tracking por usuário
CREATE INDEX IF NOT EXISTS idx_rdp_user_id
    ON public.radar_discovered_products (user_id);

-- ─── Trigger de updated_at (padrão do projeto) ───────────────────────────────
DROP TRIGGER IF EXISTS update_radar_discovered_products_updated_at ON public.radar_discovered_products;
CREATE TRIGGER update_radar_discovered_products_updated_at
    BEFORE UPDATE ON public.radar_discovered_products
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
-- Esta é uma tabela operacional (server-side only via service role).
-- O frontend não lê esta tabela diretamente.
-- Políticas conservadoras: usuário pode ver os próprios registros, mas
-- INSERT/UPDATE/DELETE são exclusivos do service role (backend).
ALTER TABLE public.radar_discovered_products ENABLE ROW LEVEL SECURITY;

-- DROP explícito fora de DO $$ para não silenciar erros acidentalmente
DROP POLICY IF EXISTS "Users can view own radar discovered products" ON public.radar_discovered_products;

CREATE POLICY "Users can view own radar discovered products"
    ON public.radar_discovered_products
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
-- INSERT/UPDATE/DELETE: bloqueados para anon/authenticated — somente service_role opera
