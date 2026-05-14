-- migration: 20260514130000_fix_discovered_promo_pages_grants.sql
-- Objetivo: Ajustar privilgios da tabela discovered_promo_pages para segurança máxima.

-- 1. Garantir apenas privilgio de LEITURA para usuários autenticados
GRANT SELECT ON TABLE public.discovered_promo_pages TO authenticated;

-- 2. Revogar explicitamente qualquer privilgio de escrita para usuários autenticados
REVOKE INSERT ON TABLE public.discovered_promo_pages FROM authenticated;
REVOKE UPDATE ON TABLE public.discovered_promo_pages FROM authenticated;
REVOKE DELETE ON TABLE public.discovered_promo_pages FROM authenticated;

-- 3. Revogar TODO e QUALQUER acesso para o role anon
-- Garante que acessos não autenticados recebam "permission denied" imediatamente.
REVOKE ALL ON TABLE public.discovered_promo_pages FROM anon;

-- Nota: As operações de escrita (Radar/Automação) e leitura via API 
-- continuam funcionando via service_role (Admin Client) no backend.
