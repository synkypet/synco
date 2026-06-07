-- Criação do bucket 'automation-media' se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('automation-media', 'automation-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Criação de RLS Policies para o bucket 'automation-media'

-- Limpa policies antigas caso existam
DROP POLICY IF EXISTS "Public Access for automation-media" ON storage.objects;
DROP POLICY IF EXISTS "Auth Users Can Upload to automation-media" ON storage.objects;
DROP POLICY IF EXISTS "Auth Users Can Update/Delete their automation-media" ON storage.objects;
DROP POLICY IF EXISTS "Auth Users Can Delete their automation-media" ON storage.objects;

-- Policy para permitir SELECT para todos (bucket é publico para acesso de leitura por URL)
CREATE POLICY "Public Access for automation-media" ON storage.objects
  FOR SELECT USING (bucket_id = 'automation-media');

-- NOTA: Como o upload/update/delete é feito 100% via API Server-Side usando
-- a role de service (supabaseAdmin), NÃO criamos policies genéricas de escrita
-- para usuários autenticados no client-side. Isso previne que usuários forjem
-- requests manipulando arquivos de terceiros.
