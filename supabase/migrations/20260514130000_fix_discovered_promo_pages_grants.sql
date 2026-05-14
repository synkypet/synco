-- migration: 20260514130000_fix_discovered_promo_pages_grants.sql
-- Objetivo: Corrigir erro de permisso na listagem de pginas promocionais.

-- 1. Garantir privilgios de leitura para usurios autenticados
-- Sem isso, mesmo com RLS ativa, o banco retorna "permission denied" antes de avaliar as policies.
GRANT SELECT ON TABLE public.discovered_promo_pages TO authenticated;

-- 2. Garantir privilgios para o role anon (se necessrio para o flow de verificação inicial)
-- A RLS ainda impedir acesso annimo real, mas evita erro de negao bruta de privilgio.
GRANT SELECT ON TABLE public.discovered_promo_pages TO anon;

-- Nota: No concedemos INSERT, UPDATE ou DELETE paraauthenticated/anon.
-- Essas operaes continuam restritas ao service_role via backend.
