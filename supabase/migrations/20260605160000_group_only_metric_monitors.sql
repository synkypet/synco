BEGIN;

-- 1. Adicionar o tipo de monitoramento
ALTER TABLE public.sm_metric_monitors
ADD COLUMN IF NOT EXISTS monitor_type text DEFAULT 'meta_campaign';

-- 2. Garantir que registros antigos fiquem como meta_campaign
UPDATE public.sm_metric_monitors
SET monitor_type = 'meta_campaign'
WHERE monitor_type IS NULL;

-- 3. Remover obrigatoriedade global dos campos de Meta
ALTER TABLE public.sm_metric_monitors
ALTER COLUMN campaign_id DROP NOT NULL;

ALTER TABLE public.sm_metric_monitors
ALTER COLUMN campaign_name DROP NOT NULL;

ALTER TABLE public.sm_metric_monitors
ALTER COLUMN ad_account_id DROP NOT NULL;

-- 4. Remover constraints antigas se existirem
DO $$
DECLARE
    con_name text;
BEGIN
    SELECT c.conname INTO con_name
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'sm_metric_monitors'
      AND c.contype = 'u'
      AND c.conname LIKE '%user_id_group_id_campaign_id%';

    IF con_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.sm_metric_monitors DROP CONSTRAINT ' || quote_ident(con_name);
    END IF;
END $$;

-- 5. Remover constraints/checks anteriores com mesmo nome, se existirem
ALTER TABLE public.sm_metric_monitors
DROP CONSTRAINT IF EXISTS sm_metric_monitors_monitor_type_check;

ALTER TABLE public.sm_metric_monitors
DROP CONSTRAINT IF EXISTS sm_metric_monitors_meta_fields_check;

-- 6. Check do tipo
ALTER TABLE public.sm_metric_monitors
ADD CONSTRAINT sm_metric_monitors_monitor_type_check
CHECK (monitor_type IN ('meta_campaign', 'group_only'));

-- 7. Check de consistência dos campos Meta
ALTER TABLE public.sm_metric_monitors
ADD CONSTRAINT sm_metric_monitors_meta_fields_check
CHECK (
  (
    monitor_type = 'meta_campaign'
    AND campaign_id IS NOT NULL
    AND campaign_name IS NOT NULL
    AND ad_account_id IS NOT NULL
  )
  OR
  (
    monitor_type = 'group_only'
  )
);

-- 8. Índice único para monitoramentos Meta + Grupo
DROP INDEX IF EXISTS public.uq_sm_monitors_meta_campaign;

CREATE UNIQUE INDEX uq_sm_monitors_meta_campaign
ON public.sm_metric_monitors(user_id, group_id, campaign_id)
WHERE monitor_type = 'meta_campaign';

-- 9. Índice único para monitoramentos Apenas Grupo
DROP INDEX IF EXISTS public.uq_sm_monitors_group_only;

CREATE UNIQUE INDEX uq_sm_monitors_group_only
ON public.sm_metric_monitors(user_id, group_id)
WHERE monitor_type = 'group_only';

COMMIT;
