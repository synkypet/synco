create index if not exists idx_campaigns_user_created_at
on public.campaigns (user_id, created_at desc);

create index if not exists idx_campaign_items_campaign_id
on public.campaign_items (campaign_id);

create index if not exists idx_campaign_destinations_campaign_id
on public.campaign_destinations (campaign_id);
