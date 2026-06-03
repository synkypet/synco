BEGIN;

-- Permissões para usuários autenticados na tabela de configuração/opt-in
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.sm_monitored_groups
TO authenticated;

-- Snapshots e deltas são somente leitura para usuários autenticados
GRANT SELECT
ON TABLE public.sm_group_snapshots
TO authenticated;

GRANT SELECT
ON TABLE public.sm_group_deltas
TO authenticated;

-- Discovered groups: usuário pode ler e atualizar status dismissed/ignored via RLS
GRANT SELECT, UPDATE
ON TABLE public.sm_discovered_groups
TO authenticated;

-- Service role/worker precisa operar nas tabelas sm_
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.sm_monitored_groups
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.sm_group_snapshots
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.sm_group_deltas
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.sm_discovered_groups
TO service_role;

COMMIT;
