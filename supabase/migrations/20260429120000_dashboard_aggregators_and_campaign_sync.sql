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
CREATE OR REPLACE FUNCTION check_and_close_campaign(p_campaign_id UUID)
RETURNS VOID AS $$
DECLARE
    v_pending_count INT;
BEGIN
    -- Conta jobs que ainda não terminaram (inclui processing e scheduled)
    SELECT COUNT(*) INTO v_pending_count
    FROM send_jobs
    WHERE campaign_id = p_campaign_id
      AND status IN ('pending', 'processing', 'scheduled');

    -- Se não houver mais nada pendente, fecha a campanha de forma idempotente
    -- Mitigação de Race Condition via check de status na clausula WHERE
    IF v_pending_count = 0 THEN
        UPDATE campaigns 
        SET status = 'completed', 
            updated_at = NOW()
        WHERE id = p_campaign_id 
          AND status != 'completed';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
