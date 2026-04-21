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
  image_url?: string | null;
  external_product_id?: string | null;
  installments?: string | null;
  created_at?: string;

  // Rastreabilidade (Fase 1)
  incoming_url?: string | null;
  resolved_url?: string | null;
  canonical_url?: string | null;
  generated_affiliate_url?: string | null;
  redirect_chain?: any[] | null;
  reaffiliation_status?: string | null;
  reaffiliation_error?: string | null;

  // Elegibilidade Operacional (Fase 2)
  eligibility_status?: 'eligible' | 'warning' | 'ineligible' | null;
  eligibility_reasons?: string[] | null;
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
    image_url?: string | null;
    external_product_id?: string | null;
    installments?: string | null;

    // Rastreabilidade (Fase 1)
    incoming_url?: string;
    resolved_url?: string;
    canonical_url?: string;
    generated_affiliate_url?: string;
    redirect_chain?: any[];
    reaffiliation_status?: string;
    reaffiliation_error?: string;

    // Elegibilidade Operacional (Fase 2)
    eligibility_status: 'eligible' | 'warning' | 'ineligible';
    eligibility_reasons: string[];
  }[];
  destinations: {
    type: 'list' | 'group';
    id: string;
  }[];
}
