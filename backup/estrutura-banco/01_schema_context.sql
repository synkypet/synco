-- SYNCO — Schema Context (Table Definitions)
-- Este arquivo contém a estrutura básica das tabelas.
-- Execute este arquivo após as extensões (07_extensions.sql).

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Marketplaces
CREATE TABLE IF NOT EXISTS public.marketplaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    icon TEXT,
    color TEXT,
    description TEXT,
    configured BOOLEAN DEFAULT FALSE,
    affiliate_id TEXT,
    last_validated TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Channels
CREATE TABLE IF NOT EXISTS public.channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    description TEXT,
    config JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Groups
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    marketplace_id UUID REFERENCES public.marketplaces(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    remote_id TEXT,
    is_source BOOLEAN DEFAULT FALSE,
    is_destination BOOLEAN DEFAULT FALSE,
    is_monitored BOOLEAN DEFAULT FALSE,
    members_count INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT,
    status TEXT DEFAULT 'pending',
    scheduled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign Items
CREATE TABLE IF NOT EXISTS public.campaign_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    product_id UUID, 
    product_name TEXT NOT NULL, 
    custom_text TEXT, 
    affiliate_url TEXT,
    image_url TEXT,
    external_product_id TEXT,
    installments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Send Jobs
CREATE TABLE IF NOT EXISTS public.send_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    campaign_item_id UUID,
    destination TEXT NOT NULL,
    destination_name TEXT,
    message_body TEXT NOT NULL,
    image_url TEXT,
    message_type TEXT DEFAULT 'text',
    status TEXT DEFAULT 'pending',
    try_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_error TEXT,
    error_type TEXT,
    fallback_channel_id UUID,
    scheduled_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Secrets (Obrigatório para o funcionamento do provider)
CREATE TABLE IF NOT EXISTS public.channel_secrets (
    channel_id UUID PRIMARY KEY REFERENCES public.channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_api_key TEXT,
    webhook_secret TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
