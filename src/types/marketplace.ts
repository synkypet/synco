export interface Marketplace {
    id: string;
    name: string;
    icon: string;
    color: string;
    description?: string;
    configured: boolean;
    affiliate_id?: string;
    last_validated?: string;
    created_at?: string;
    updated_at?: string;
}

export interface UserMarketplaceConnection {
    id: string;
    user_id: string;
    marketplace_id: string;
    is_active: boolean;
    affiliate_id?: string;
    affiliate_code?: string;
    affiliate_username?: string;
    shopee_app_id?: string;
    shopee_app_secret?: string; // used for transit
    has_secret?: boolean; // stored UI flag ensuring config exists
    created_at: string;
    updated_at: string;
}

export interface MarketplaceWithConnection extends Marketplace {
    connection?: UserMarketplaceConnection;
}
