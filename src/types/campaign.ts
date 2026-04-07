// src/types/campaign.ts

export type CampaignStatus = 'pending' | 'sending' | 'completed' | 'failed' | 'scheduled';

export interface Campaign {
  id: string;
  user_id: string;
  name?: string;
  status: CampaignStatus;
  scheduled_at?: string | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  items?: CampaignItem[];
  destinations?: CampaignDestination[];
  // UI/Joined fields
  products_count?: number;
  sent_count?: number;
  pending_count?: number;
  failed_count?: number;
  template_name?: string;
  segment_name?: string;
}

export interface CampaignItem {
  id: string;
  campaign_id: string;
  product_id?: string | null;
  product_name: string;
  custom_text?: string | null;
  affiliate_url?: string | null;
  created_at?: string;
}

export interface CampaignDestination {
  id: string;
  campaign_id: string;
  destination_type: 'list' | 'group';
  destination_id: string;
  created_at?: string;
}

export interface CreateCampaignDTO {
  name?: string;
  scheduled_at?: string;
  items: {
    product_id?: string;
    product_name: string;
    custom_text?: string;
    affiliate_url?: string;
  }[];
  destinations: {
    type: 'list' | 'group';
    id: string;
  }[];
}
