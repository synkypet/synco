-- 20240429000000_add_is_primary_to_channels.sql
-- Adiciona a coluna is_primary para definir o canal principal exibido na Topbar

ALTER TABLE public.channels 
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE;

-- Comentário para auditoria
COMMENT ON COLUMN public.channels.is_primary IS 'Define se este é o canal principal do usuário para exibição de status na Topbar';
