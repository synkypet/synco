-- 1. RPC para Sumário do Dashboard (Totais Absolutos)
CREATE OR REPLACE FUNCTION get_dashboard_summary(p_user_id UUID, p_days INT)
RETURNS TABLE (
    total_sent BIGINT,
    total_failed BIGINT,
    total_pending BIGINT
) AS $$
BEGIN
    -- SECURITY DEFINER: Explicit filter by user_id inside the query
    RETURN QUERY
    SELECT 
        COUNT(*) FILTER (WHERE status IN ('completed', 'sent')) as total_sent,
        COUNT(*) FILTER (WHERE status = 'failed') as total_failed,
        COUNT(*) FILTER (WHERE status IN ('pending', 'processing')) as total_pending
    FROM send_jobs
    WHERE user_id = p_user_id
      AND created_at >= (CURRENT_DATE - (p_days || ' days')::INTERVAL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RPC para Gráficos de Performance (Evolução Temporal)
CREATE OR REPLACE FUNCTION get_operational_stats(p_user_id UUID, p_days INT)
RETURNS TABLE (
    day DATE,
    enviados BIGINT,
    falhas BIGINT,
    pendentes BIGINT
) AS $$
BEGIN
    -- SECURITY DEFINER: Explicit filter by user_id inside the query
    RETURN QUERY
    SELECT 
        created_at::DATE as day,
        COUNT(*) FILTER (WHERE status IN ('completed', 'sent')) as enviados,
        COUNT(*) FILTER (WHERE status = 'failed') as falhas,
        COUNT(*) FILTER (WHERE status IN ('pending', 'processing')) as pendentes
    FROM send_jobs
    WHERE user_id = p_user_id
      AND created_at >= (CURRENT_DATE - (p_days || ' days')::INTERVAL)
    GROUP BY day
    ORDER BY day ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Função Idempotente para Fechamento de Campanha
CREATE OR REPLACE FUNCTION public.check_and_close_campaign(p_campaign_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.campaigns
    SET status = 'completed',
        updated_at = NOW()
    WHERE id = p_campaign_id
      AND status != 'completed'
      AND NOT EXISTS (
          SELECT 1
          FROM public.send_jobs
          WHERE campaign_id = p_campaign_id
            AND status IN ('pending', 'processing', 'scheduled')
      );
END;
$$;
