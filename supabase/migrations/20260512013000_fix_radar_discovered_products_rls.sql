-- supabase/migrations/20260512013000_fix_radar_discovered_products_rls.sql
-- Description: Corrige a falta de permissão de SELECT e refina a política RLS para radar_discovered_products.

-- 1. Garantir Permissão de Leitura
GRANT SELECT ON public.radar_discovered_products TO authenticated;

-- 2. Habilitar RLS (caso não esteja)
ALTER TABLE public.radar_discovered_products ENABLE ROW LEVEL SECURITY;

-- 3. Criar Política Segura
-- Permite que o usuário veja apenas os produtos descobertos vinculados às SUAS fontes.
DROP POLICY IF EXISTS "Users can view own radar discovered products" ON public.radar_discovered_products;

CREATE POLICY "Users can view own radar discovered products"
ON public.radar_discovered_products
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.automation_sources s
    WHERE s.id = radar_discovered_products.source_id
      AND s.user_id = auth.uid()
  )
);

-- 4. Notificar PostgREST para recarregar o schema
NOTIFY pgrst, 'reload schema';
