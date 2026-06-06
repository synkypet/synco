alter table public.automation_coupon_rules add column if not exists sort_order integer default 0;

alter table public.automation_routes add column if not exists coupon_interval_min_minutes integer default 60, add column if not exists coupon_interval_max_minutes integer default 60;
