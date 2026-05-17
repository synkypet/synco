-- migration: 20260517090800_alter_coupon_rules_interval_minutes.sql
-- Objetivo: Reduzir a restrição de intervalo mínimo de envio de cupons de 10 minutos para 1 minuto.

-- 1. Remover a restrição de verificação (CHECK constraint) antiga
ALTER TABLE public.automation_coupon_rules 
DROP CONSTRAINT IF EXISTS automation_coupon_rules_interval_minutes_check;

-- 2. Adicionar a nova restrição permitindo intervalos >= 1 minuto
ALTER TABLE public.automation_coupon_rules 
ADD CONSTRAINT automation_coupon_rules_interval_minutes_check CHECK (interval_minutes >= 1);
