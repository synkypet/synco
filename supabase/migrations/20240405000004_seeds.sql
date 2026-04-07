-- 04_seeds.sql
-- Dados iniciais para Marketplaces

INSERT INTO public.marketplaces (name, icon, color, description, configured)
VALUES 
  ('Shopee', 'shopping_bag', '#EE4D2D', 'Marketplace global com foco em ofertas variadas.', true),
  ('Mercado Livre', 'local_shipping', '#FFE600', 'Líder em e-commerce na América Latina.', true),
  ('Amazon', 'amazon', '#FF9900', 'O maior marketplace do mundo.', true),
  ('Magalu', 'shopping_cart', '#0086FF', 'Varejista brasileira com ecossistema completo.', true),
  ('AliExpress', 'global', '#E62E04', 'Gigante chinês de exportação global.', true),
  ('Shein', 'style', '#000000', 'Foco em moda e lifestyle com preços competitivos.', true)
ON CONFLICT (name) DO UPDATE 
SET 
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  description = EXCLUDED.description,
  configured = EXCLUDED.configured;
