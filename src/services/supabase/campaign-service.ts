// src/services/supabase/campaign-service.ts
import { createClient } from '@/lib/supabase/client';
import { Campaign, CreateCampaignDTO } from '@/types/campaign';

export const campaignService = {
  async list(userId: string): Promise<Campaign[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        items:campaign_items(*),
        destinations:campaign_destinations(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching campaigns:', error);
      throw error;
    }

    return data as Campaign[];
  },

  async create(userId: string, dto: CreateCampaignDTO): Promise<Campaign> {
    const supabase = createClient();

    // 1. Insert campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        user_id: userId,
        name: dto.name || `Envio ${new Date().toLocaleString()}`,
        status: dto.scheduled_at ? 'scheduled' : 'completed',
        scheduled_at: dto.scheduled_at
      })
      .select()
      .single();

    if (campaignError) {
      console.error('Error creating campaign:', campaignError);
      throw campaignError;
    }

    // 2. Insert items
    if (dto.items && dto.items.length > 0) {
      const itemsToInsert = dto.items.map(item => ({
        campaign_id: campaign.id,
        product_id: item.product_id,
        product_name: item.product_name,
        custom_text: item.custom_text,
        affiliate_url: item.affiliate_url
      }));

      const { error: itemsError } = await supabase
        .from('campaign_items')
        .insert(itemsToInsert);

      if (itemsError) {
        console.error('Error inserting campaign items:', itemsError);
        throw itemsError;
      }
    }

    // 3. Insert destinations
    if (dto.destinations && dto.destinations.length > 0) {
      const destinationsToInsert = dto.destinations.map(dest => ({
        campaign_id: campaign.id,
        destination_type: dest.type,
        destination_id: dest.id
      }));

      const { error: destError } = await supabase
        .from('campaign_destinations')
        .insert(destinationsToInsert);

      if (destError) {
        console.error('Error inserting campaign destinations:', destError);
        throw destError;
      }
    }

    return campaign as Campaign;
  },

  async getById(id: string, userId: string): Promise<Campaign | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        items:campaign_items(*),
        destinations:campaign_destinations(*)
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('Error fetching campaign by id:', error);
      throw error;
    }

    return data as Campaign;
  },

  async delete(id: string, userId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting campaign:', error);
      throw error;
    }
  }
};
