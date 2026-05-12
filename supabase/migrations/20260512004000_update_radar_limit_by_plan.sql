-- Migration: 20260512004000_update_radar_limit_by_plan.sql
-- Description: Atualiza a trigger enforce_radar_sources_limit para ler max_radars do plano ativo.

CREATE OR REPLACE FUNCTION public.enforce_radar_sources_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_radars integer := 0;
BEGIN
  IF NEW.source_type = 'radar_offers' AND COALESCE(NEW.is_active, true) = true THEN

    PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));

    SELECT COALESCE((p.limits->'quotas'->>'max_radars')::integer, 0)
    INTO v_plan_radars
    FROM public.subscriptions s
    JOIN public.plans p ON s.plan_id = p.id
    WHERE s.user_id = NEW.user_id
      AND s.status IN ('active', 'trialing')
      AND (
        s.current_period_end IS NULL
        OR s.current_period_end > now()
      )
    ORDER BY s.current_period_end DESC NULLS LAST, s.created_at DESC
    LIMIT 1;

    v_plan_radars := COALESCE(v_plan_radars, 0);

    IF v_plan_radars <= 0 THEN
      RAISE EXCEPTION 'Seu plano atual não inclui Radares. Faça upgrade para criar automações Radar.'
        USING ERRCODE = 'P0001';
    END IF;

    IF (
      SELECT count(*)
      FROM public.automation_sources
      WHERE user_id = NEW.user_id
        AND source_type = 'radar_offers'
        AND is_active = true
        AND id IS DISTINCT FROM NEW.id
    ) >= v_plan_radars THEN
      RAISE EXCEPTION 'Você atingiu o limite de Radares ativos do seu plano. Desative um Radar existente ou faça upgrade para criar mais.'
        USING ERRCODE = 'P0001';
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_radar_sources_limit ON public.automation_sources;
DROP TRIGGER IF EXISTS trigger_enforce_radar_sources_limit ON public.automation_sources;

CREATE TRIGGER trg_enforce_radar_sources_limit
BEFORE INSERT OR UPDATE OF is_active, source_type, user_id
ON public.automation_sources
FOR EACH ROW
EXECUTE FUNCTION public.enforce_radar_sources_limit();
