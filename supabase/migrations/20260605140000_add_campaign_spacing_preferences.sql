-- Migration para adicionar preferências globais de espaçamento de campanhas

alter table public.user_send_preferences
add column if not exists campaign_spacing_min_seconds integer,
add column if not exists campaign_spacing_max_seconds integer;

comment on column public.user_send_preferences.campaign_spacing_min_seconds
is 'Minimum global spacing in seconds between campaigns for this user';

comment on column public.user_send_preferences.campaign_spacing_max_seconds
is 'Maximum global spacing in seconds between campaigns for this user';
