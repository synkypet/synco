-- Migration: Enforce Radar Sources Limit
-- Description: Impede que um usuário tenha mais de 3 radares ativos simultaneamente.
-- Note: Esta regra não bloqueia edições de configurações (nome, filtros, etc) de radares existentes, 
-- apenas novas ativações ou criações que excedam o limite.

CREATE OR REPLACE FUNCTION public.enforce_radar_sources_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_radar_count integer;
  max_radar_sources integer := 3; -- Limite hardcoded conforme solicitado
BEGIN
  -- Só aplicamos a lógica se estivermos inserindo ou atualizando um radar para ATIVO
  -- Outros source_type não são afetados.
  IF NEW.source_type = 'radar_offers' AND COALESCE(NEW.is_active, true) = true THEN
    
    -- Evita condição de corrida entre duas criações simultâneas do mesmo usuário
    PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));

    -- Contamos quantos radares ativos o usuário já possui, excluindo o próprio registro (em caso de update)
    SELECT COUNT(*)
    INTO active_radar_count
    FROM public.automation_sources
    WHERE user_id = NEW.user_id
      AND source_type = 'radar_offers'
      AND is_active = true
      AND id IS DISTINCT FROM NEW.id;

    IF active_radar_count >= max_radar_sources THEN
      RAISE EXCEPTION 'Você atingiu o limite de radares ativos. Desative ou exclua um radar existente para criar outro.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger disparada apenas em colunas que alteram o estado de quota
DROP TRIGGER IF EXISTS trg_enforce_radar_sources_limit ON public.automation_sources;

CREATE TRIGGER trg_enforce_radar_sources_limit
BEFORE INSERT OR UPDATE OF is_active, source_type, user_id
ON public.automation_sources
FOR EACH ROW
EXECUTE FUNCTION public.enforce_radar_sources_limit();
