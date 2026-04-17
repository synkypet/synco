-- SYNCO — Índices de Performance
-- Este arquivo contém os índices para otimização de busca e filtragem.
--
-- INSTRUÇÕES:
-- 1. Identifique os índices criados manualmente no banco.
-- 2. No SQL Editor, você pode rodar "SELECT * FROM pg_indexes WHERE schemaname = 'public';" para listar.
-- 3. Foque em índices de chaves estrangeiras (FKs) e campos usados em filtros de lista ou automação.

-- Cole abaixo seus índices:
[
  {
    "schemaname": "public",
    "tablename": "automation_dedupe",
    "indexname": "automation_dedupe_pkey",
    "indexdef": "CREATE UNIQUE INDEX automation_dedupe_pkey ON public.automation_dedupe USING btree (hash_key)"
  },
  {
    "schemaname": "public",
    "tablename": "automation_dedupe",
    "indexname": "idx_automation_dedupe_expire",
    "indexdef": "CREATE INDEX idx_automation_dedupe_expire ON public.automation_dedupe USING btree (created_at)"
  },
  {
    "schemaname": "public",
    "tablename": "automation_logs",
    "indexname": "automation_logs_pkey",
    "indexdef": "CREATE UNIQUE INDEX automation_logs_pkey ON public.automation_logs USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "automation_logs",
    "indexname": "idx_automation_logs_source",
    "indexdef": "CREATE INDEX idx_automation_logs_source ON public.automation_logs USING btree (source_id)"
  },
  {
    "schemaname": "public",
    "tablename": "automation_routes",
    "indexname": "automation_routes_pkey",
    "indexdef": "CREATE UNIQUE INDEX automation_routes_pkey ON public.automation_routes USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "automation_routes",
    "indexname": "idx_automation_routes_source",
    "indexdef": "CREATE INDEX idx_automation_routes_source ON public.automation_routes USING btree (source_id)"
  },
  {
    "schemaname": "public",
    "tablename": "automation_sources",
    "indexname": "automation_sources_pkey",
    "indexdef": "CREATE UNIQUE INDEX automation_sources_pkey ON public.automation_sources USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "automation_sources",
    "indexname": "idx_automation_sources_external",
    "indexdef": "CREATE INDEX idx_automation_sources_external ON public.automation_sources USING btree (channel_id, external_group_id)"
  },
  {
    "schemaname": "public",
    "tablename": "automation_sources",
    "indexname": "idx_automation_sources_user",
    "indexdef": "CREATE INDEX idx_automation_sources_user ON public.automation_sources USING btree (user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "campaign_destinations",
    "indexname": "campaign_destinations_pkey",
    "indexdef": "CREATE UNIQUE INDEX campaign_destinations_pkey ON public.campaign_destinations USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "campaign_items",
    "indexname": "campaign_items_pkey",
    "indexdef": "CREATE UNIQUE INDEX campaign_items_pkey ON public.campaign_items USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "campaigns",
    "indexname": "campaigns_pkey",
    "indexdef": "CREATE UNIQUE INDEX campaigns_pkey ON public.campaigns USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "campaigns",
    "indexname": "idx_campaigns_status",
    "indexdef": "CREATE INDEX idx_campaigns_status ON public.campaigns USING btree (status)"
  },
  {
    "schemaname": "public",
    "tablename": "campaigns",
    "indexname": "idx_campaigns_user_id",
    "indexdef": "CREATE INDEX idx_campaigns_user_id ON public.campaigns USING btree (user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "channel_secrets",
    "indexname": "channel_secrets_pkey",
    "indexdef": "CREATE UNIQUE INDEX channel_secrets_pkey ON public.channel_secrets USING btree (channel_id)"
  },
  {
    "schemaname": "public",
    "tablename": "channels",
    "indexname": "channels_pkey",
    "indexdef": "CREATE UNIQUE INDEX channels_pkey ON public.channels USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "channels",
    "indexname": "idx_channels_user_id",
    "indexdef": "CREATE INDEX idx_channels_user_id ON public.channels USING btree (user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "contacts",
    "indexname": "contacts_channel_id_remote_id_key",
    "indexdef": "CREATE UNIQUE INDEX contacts_channel_id_remote_id_key ON public.contacts USING btree (channel_id, remote_id)"
  },
  {
    "schemaname": "public",
    "tablename": "contacts",
    "indexname": "contacts_channel_remote_unique",
    "indexdef": "CREATE UNIQUE INDEX contacts_channel_remote_unique ON public.contacts USING btree (channel_id, remote_id)"
  },
  {
    "schemaname": "public",
    "tablename": "contacts",
    "indexname": "contacts_pkey",
    "indexdef": "CREATE UNIQUE INDEX contacts_pkey ON public.contacts USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "contacts",
    "indexname": "idx_contacts_remote_id",
    "indexdef": "CREATE INDEX idx_contacts_remote_id ON public.contacts USING btree (remote_id)"
  },
  {
    "schemaname": "public",
    "tablename": "contacts",
    "indexname": "idx_contacts_user_id",
    "indexdef": "CREATE INDEX idx_contacts_user_id ON public.contacts USING btree (user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "destination_list_groups",
    "indexname": "destination_list_groups_pkey",
    "indexdef": "CREATE UNIQUE INDEX destination_list_groups_pkey ON public.destination_list_groups USING btree (list_id, group_id)"
  },
  {
    "schemaname": "public",
    "tablename": "destination_list_groups",
    "indexname": "idx_dlg_group_id",
    "indexdef": "CREATE INDEX idx_dlg_group_id ON public.destination_list_groups USING btree (group_id)"
  },
  {
    "schemaname": "public",
    "tablename": "destination_list_groups",
    "indexname": "idx_dlg_list_id",
    "indexdef": "CREATE INDEX idx_dlg_list_id ON public.destination_list_groups USING btree (list_id)"
  },
  {
    "schemaname": "public",
    "tablename": "destination_lists",
    "indexname": "destination_lists_pkey",
    "indexdef": "CREATE UNIQUE INDEX destination_lists_pkey ON public.destination_lists USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "destination_lists",
    "indexname": "idx_destination_lists_user_id",
    "indexdef": "CREATE INDEX idx_destination_lists_user_id ON public.destination_lists USING btree (user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "earnings_import_items",
    "indexname": "earnings_import_items_pkey",
    "indexdef": "CREATE UNIQUE INDEX earnings_import_items_pkey ON public.earnings_import_items USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "earnings_import_items",
    "indexname": "idx_earnings_import_items_import_id",
    "indexdef": "CREATE INDEX idx_earnings_import_items_import_id ON public.earnings_import_items USING btree (import_id)"
  },
  {
    "schemaname": "public",
    "tablename": "earnings_import_items",
    "indexname": "idx_earnings_import_items_occurred_at",
    "indexdef": "CREATE INDEX idx_earnings_import_items_occurred_at ON public.earnings_import_items USING btree (occurred_at)"
  },
  {
    "schemaname": "public",
    "tablename": "earnings_import_items",
    "indexname": "idx_earnings_import_items_user_id",
    "indexdef": "CREATE INDEX idx_earnings_import_items_user_id ON public.earnings_import_items USING btree (user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "earnings_imports",
    "indexname": "earnings_imports_pkey",
    "indexdef": "CREATE UNIQUE INDEX earnings_imports_pkey ON public.earnings_imports USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "earnings_imports",
    "indexname": "idx_earnings_imports_user_id",
    "indexdef": "CREATE INDEX idx_earnings_imports_user_id ON public.earnings_imports USING btree (user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "groups",
    "indexname": "groups_channel_id_remote_id_key",
    "indexdef": "CREATE UNIQUE INDEX groups_channel_id_remote_id_key ON public.groups USING btree (channel_id, remote_id)"
  },
  {
    "schemaname": "public",
    "tablename": "groups",
    "indexname": "groups_pkey",
    "indexdef": "CREATE UNIQUE INDEX groups_pkey ON public.groups USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "groups",
    "indexname": "idx_groups_channel_id",
    "indexdef": "CREATE INDEX idx_groups_channel_id ON public.groups USING btree (channel_id)"
  },
  {
    "schemaname": "public",
    "tablename": "groups",
    "indexname": "idx_groups_channel_last_seen_at",
    "indexdef": "CREATE INDEX idx_groups_channel_last_seen_at ON public.groups USING btree (channel_id, last_seen_at)"
  },
  {
    "schemaname": "public",
    "tablename": "groups",
    "indexname": "idx_groups_user_id",
    "indexdef": "CREATE INDEX idx_groups_user_id ON public.groups USING btree (user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "maintenance_locks",
    "indexname": "maintenance_locks_pkey",
    "indexdef": "CREATE UNIQUE INDEX maintenance_locks_pkey ON public.maintenance_locks USING btree (key)"
  },
  {
    "schemaname": "public",
    "tablename": "marketplaces",
    "indexname": "marketplaces_name_key",
    "indexdef": "CREATE UNIQUE INDEX marketplaces_name_key ON public.marketplaces USING btree (name)"
  },
  {
    "schemaname": "public",
    "tablename": "marketplaces",
    "indexname": "marketplaces_pkey",
    "indexdef": "CREATE UNIQUE INDEX marketplaces_pkey ON public.marketplaces USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "products",
    "indexname": "idx_products_category",
    "indexdef": "CREATE INDEX idx_products_category ON public.products USING btree (category)"
  },
  {
    "schemaname": "public",
    "tablename": "products",
    "indexname": "idx_products_marketplace",
    "indexdef": "CREATE INDEX idx_products_marketplace ON public.products USING btree (marketplace)"
  },
  {
    "schemaname": "public",
    "tablename": "products",
    "indexname": "idx_products_opportunity_score",
    "indexdef": "CREATE INDEX idx_products_opportunity_score ON public.products USING btree (opportunity_score DESC)"
  },
  {
    "schemaname": "public",
    "tablename": "products",
    "indexname": "products_pkey",
    "indexdef": "CREATE UNIQUE INDEX products_pkey ON public.products USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "indexname": "profiles_pkey",
    "indexdef": "CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "indexname": "profiles_username_key",
    "indexdef": "CREATE UNIQUE INDEX profiles_username_key ON public.profiles USING btree (username)"
  },
  {
    "schemaname": "public",
    "tablename": "send_jobs",
    "indexname": "idx_send_jobs_campaign_created",
    "indexdef": "CREATE INDEX idx_send_jobs_campaign_created ON public.send_jobs USING btree (campaign_id, created_at DESC)"
  },
  {
    "schemaname": "public",
    "tablename": "send_jobs",
    "indexname": "idx_send_jobs_campaign_id",
    "indexdef": "CREATE INDEX idx_send_jobs_campaign_id ON public.send_jobs USING btree (campaign_id)"
  },
  {
    "schemaname": "public",
    "tablename": "send_jobs",
    "indexname": "idx_send_jobs_campaign_status",
    "indexdef": "CREATE INDEX idx_send_jobs_campaign_status ON public.send_jobs USING btree (campaign_id, status)"
  },
  {
    "schemaname": "public",
    "tablename": "send_jobs",
    "indexname": "idx_send_jobs_channel_pacing",
    "indexdef": "CREATE INDEX idx_send_jobs_channel_pacing ON public.send_jobs USING btree (channel_id, processed_at DESC) WHERE (processed_at IS NOT NULL)"
  },
  {
    "schemaname": "public",
    "tablename": "send_jobs",
    "indexname": "idx_send_jobs_destination_processed",
    "indexdef": "CREATE INDEX idx_send_jobs_destination_processed ON public.send_jobs USING btree (destination, processed_at DESC)"
  },
  {
    "schemaname": "public",
    "tablename": "send_jobs",
    "indexname": "idx_send_jobs_pending_dispatch",
    "indexdef": "CREATE INDEX idx_send_jobs_pending_dispatch ON public.send_jobs USING btree (status, created_at, channel_id) WHERE (status = 'pending'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "send_jobs",
    "indexname": "idx_send_jobs_processing_status",
    "indexdef": "CREATE INDEX idx_send_jobs_processing_status ON public.send_jobs USING btree (status, updated_at) WHERE (status = 'processing'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "send_jobs",
    "indexname": "idx_send_jobs_status_session",
    "indexdef": "CREATE INDEX idx_send_jobs_status_session ON public.send_jobs USING btree (status, session_id) WHERE (status = 'pending'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "send_jobs",
    "indexname": "idx_send_jobs_user_id",
    "indexdef": "CREATE INDEX idx_send_jobs_user_id ON public.send_jobs USING btree (user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "send_jobs",
    "indexname": "send_jobs_pkey",
    "indexdef": "CREATE UNIQUE INDEX send_jobs_pkey ON public.send_jobs USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "send_jobs",
    "indexname": "uq_send_jobs_campaign_item_destination",
    "indexdef": "CREATE UNIQUE INDEX uq_send_jobs_campaign_item_destination ON public.send_jobs USING btree (campaign_id, campaign_item_id, destination)"
  },
  {
    "schemaname": "public",
    "tablename": "send_receipts",
    "indexname": "idx_send_receipts_idempotency",
    "indexdef": "CREATE UNIQUE INDEX idx_send_receipts_idempotency ON public.send_receipts USING btree (campaign_id, campaign_item_id, destination) WHERE ((campaign_id IS NOT NULL) AND (campaign_item_id IS NOT NULL))"
  },
  {
    "schemaname": "public",
    "tablename": "send_receipts",
    "indexname": "idx_send_receipts_job",
    "indexdef": "CREATE INDEX idx_send_receipts_job ON public.send_receipts USING btree (send_job_id)"
  },
  {
    "schemaname": "public",
    "tablename": "send_receipts",
    "indexname": "send_receipts_pkey",
    "indexdef": "CREATE UNIQUE INDEX send_receipts_pkey ON public.send_receipts USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "templates",
    "indexname": "idx_templates_category",
    "indexdef": "CREATE INDEX idx_templates_category ON public.templates USING btree (category)"
  },
  {
    "schemaname": "public",
    "tablename": "templates",
    "indexname": "idx_templates_user_id",
    "indexdef": "CREATE INDEX idx_templates_user_id ON public.templates USING btree (user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "templates",
    "indexname": "templates_pkey",
    "indexdef": "CREATE UNIQUE INDEX templates_pkey ON public.templates USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "user_marketplace_secrets",
    "indexname": "user_marketplace_secrets_pkey",
    "indexdef": "CREATE UNIQUE INDEX user_marketplace_secrets_pkey ON public.user_marketplace_secrets USING btree (user_id, marketplace_id)"
  },
  {
    "schemaname": "public",
    "tablename": "user_marketplaces",
    "indexname": "user_marketplaces_marketplace_id_idx",
    "indexdef": "CREATE INDEX user_marketplaces_marketplace_id_idx ON public.user_marketplaces USING btree (marketplace_id)"
  },
  {
    "schemaname": "public",
    "tablename": "user_marketplaces",
    "indexname": "user_marketplaces_pkey",
    "indexdef": "CREATE UNIQUE INDEX user_marketplaces_pkey ON public.user_marketplaces USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "user_marketplaces",
    "indexname": "user_marketplaces_user_id_idx",
    "indexdef": "CREATE INDEX user_marketplaces_user_id_idx ON public.user_marketplaces USING btree (user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "user_marketplaces",
    "indexname": "user_marketplaces_user_id_marketplace_id_key",
    "indexdef": "CREATE UNIQUE INDEX user_marketplaces_user_id_marketplace_id_key ON public.user_marketplaces USING btree (user_id, marketplace_id)"
  }
]