-- Migration para adicionar campos de cadência diretamente na tabela automation_routes
-- para a arquitetura de Automação de Cupons Fase 1 (Intervalo Global da Automação)

alter table public.automation_routes
add column if not exists coupon_interval_minutes integer default 60,
add column if not exists coupon_next_run_at timestamptz,
add column if not exists coupon_last_run_at timestamptz,
add column if not exists coupon_rotation_mode text default 'continuous';

comment on column public.automation_routes.coupon_interval_minutes
is 'Cadence in minutes for coupon dispatch on this route';

comment on column public.automation_routes.coupon_next_run_at
is 'Scheduled time for the next coupon dispatch on this route';

comment on column public.automation_routes.coupon_last_run_at
is 'Time when the last coupon dispatch occurred on this route';

comment on column public.automation_routes.coupon_rotation_mode
is 'Rotation mode for coupons (e.g., continuous)';
