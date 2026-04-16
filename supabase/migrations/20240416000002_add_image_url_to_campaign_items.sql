-- migration: 20240416000002_add_image_url_to_campaign_items.sql
-- Objetivo: Armazenar a URL da imagem do produto no histórico da campanha

ALTER TABLE public.campaign_items
ADD COLUMN IF NOT EXISTS image_url TEXT;
