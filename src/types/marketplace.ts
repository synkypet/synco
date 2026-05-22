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
    ml_affiliate_tag?: string;
    ml_matt_tool?: string;
    ml_partner_id?: string;
    has_secret?: boolean; // stored UI flag ensuring config exists
    connection_status?: 'not_connected' | 'connected' | 'error' | 'pending_verification' | 'configured';
    last_error?: string;
    last_verified_at?: string;
    created_at: string;
    updated_at: string;
}

export interface MarketplaceWithConnection extends Marketplace {
    connection?: UserMarketplaceConnection;
}
