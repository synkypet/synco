-- migration: 20240416000003_add_external_product_id_to_campaign_items.sql
-- Objetivo: Permitir salvar IDs de marketplaces (texto) sem exigir UUID do catálogo interno

ALTER TABLE public.campaign_items
ADD COLUMN IF NOT EXISTS external_product_id TEXT;
