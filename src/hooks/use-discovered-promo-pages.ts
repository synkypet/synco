import { useQuery } from '@tanstack/react-query';

export interface DiscoveredPromoPage {
  id: string;
  user_id: string;
  source_id?: string;
  marketplace: string;
  offer_type: string;
  landing_type: string;
  title?: string;
  description?: string;
  raw_url?: string;
  canonical_url?: string;
  source_url?: string;
  raw_text?: string;
  confidence: number;
  status: string;
  dedupe_key: string;
  dispatchable: boolean;
  auto_dispatch_blocked: boolean;
  block_reason: string;
  capture_count: number;
  captured_at: string;
  last_seen_at: string;
  updated_at: string;
  
  // Virtual fields from API
  effective_redemption_url?: string;
  affiliate_url?: string;
  reaffiliation_status?: string;
  reaffiliation_warning?: string;
}

interface UseDiscoveredPromoPagesOptions {
  status?: string;
  landingType?: string;
  limit?: number;
  enabled?: boolean;
}

export function useDiscoveredPromoPages(options: UseDiscoveredPromoPagesOptions = {}) {
  const { status, landingType, limit = 50, enabled = true } = options;

  return useQuery({
    queryKey: ['discovered-promo-pages', { status, landingType, limit }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (landingType) params.append('landingType', landingType);
      if (limit) params.append('limit', limit.toString());

      const res = await fetch(`/api/shopee/discovered-promo-pages?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Falha ao carregar páginas promocionais do Radar');
      }
      
      const json = await res.json();
      return json as { status: string; data: DiscoveredPromoPage[] };
    },
    enabled,
    refetchInterval: enabled ? 30000 : false, // Atualiza a cada 30 segundos apenas se habilitado
  });
}
