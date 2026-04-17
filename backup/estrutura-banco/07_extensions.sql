-- SYNCO — Extensões do Banco de Dados
-- Este arquivo deve ser o primeiro a ser executado em um banco novo.
--
-- INSTRUÇÕES:
-- 1. Identifique as extensões ativas no Supabase Dashboard -> Database -> Extensions.
-- 2. As principais extensões do SYNCO costumam incluir:

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- Para geração de UUIDs (v4)
CREATE EXTENSION IF NOT EXISTS "pg_net";         -- Se for usar webhooks nativos / net.http_post
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- Para hashing e criptografia

-- Adicione outras conforme necessário:
