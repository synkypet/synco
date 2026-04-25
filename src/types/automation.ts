// src/types/automation.ts

export interface AutomationFilters {
  min_price?: number;
  max_price?: number;
  min_commission_rate?: number;
  min_discount_percent?: number;
  category?: string;
  marketplace?: string;
  only_official_stores?: boolean;
  only_coupons?: boolean;
  min_score?: number;
  keywords_whitelist?: string[];
  keywords_blacklist?: string[];
  repost_window_hours?: number;
}

export interface AutomationTemplateConfig {
  body?: string;
  tone?: string;
}

export interface AutomationRoute {
  id: string;
  source_id: string;
  target_type: 'group' | 'list';
  target_id: string;
  template_id?: string;
  is_active: boolean;
  filters?: AutomationFilters;
  template_config?: AutomationTemplateConfig;
  created_at?: string;
  updated_at?: string;
}

export interface AutomationKeyword {
  term: string;
  weight: number; // Inteiro simples (1, 2, 3...)
  last_used_at?: string;
}

export interface AutomationSource {
  id: string;
  user_id: string;
  channel_id?: string;
  external_group_id?: string;
  name: string;
  is_active: boolean;
  source_type: 'group_monitor' | 'radar_offers';
  config?: {
    searchTerm?: string; // Fallback legatário
    keywords?: AutomationKeyword[];
    preset_type?: 'aggressive' | 'balanced' | 'conservative';
    sortType?: number;
    listType?: number;
    batchLimit?: number;
    cooldown_minutes?: number;
    [key: string]: any;
  };
  needs_restock?: boolean;
  last_restock_at?: string;
  discovery_page?: number;
  discovery_locked_until?: string | null;
  created_at?: string;
  updated_at?: string;
  automation_routes?: AutomationRoute[];
}
