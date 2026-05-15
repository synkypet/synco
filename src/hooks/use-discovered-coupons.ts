import { useQuery } from '@tanstack/react-query';

export interface DiscoveredCoupon {
  id: string;
  marketplace: string;
  offer_type: string;
  coupon_type: 'codigo' | 'link_resgate' | 'pagina_cupons';
  code: string | null;
  coupon_label: string | null;
  redemption_url: string | null;
  source_url: string | null;
  product_url: string | null;
  confidence: number;
  status: 'candidate' | 'unknown' | 'valid' | 'expired';
  dedupe_key: string;
  dispatchable: boolean;
  auto_dispatch_blocked: boolean;
  block_reason: string | null;
  capture_count: number;
  captured_at: string;
  last_seen_at: string;
  
  // Novos campos de validação (Fase 2B.1)
  validation_status: 'candidate' | 'verified' | 'rejected' | 'product_link' | 'expired';
  is_verified_coupon: boolean;
  resolved_at: string | null;

  // Novos campos virtuais injetados pela API
  effective_redemption_url?: string | null;
  reaffiliation_status?: 'not_needed' | 'resolved' | 'canonicalized' | 'reaffiliated' | 'blocked' | 'failed' | 'warning';
  reaffiliation_warning?: string | null;
}

export interface DiscoveredCouponsResponse {
  status: string;
  count: number;
  data: DiscoveredCoupon[];
}

export interface DiscoveredCouponsFilters {
  status?: string;
  validationStatus?: string;
  isVerified?: boolean;
  couponType?: string;
  search?: string;
  limit?: number;
}

/**
 * Hook para buscar cupons detectados pelo radar.
 */
export function useDiscoveredCoupons(filters: DiscoveredCouponsFilters = {}) {
  return useQuery<DiscoveredCouponsResponse, Error>({
    queryKey: ['shopee-discovered-coupons', filters],
    queryFn: async () => {
      const url = new URL('/api/shopee/discovered-coupons', window.location.origin);
      
      if (filters.status && filters.status !== 'all') {
        url.searchParams.set('status', filters.status);
      }
      if (filters.validationStatus && filters.validationStatus !== 'all') {
        url.searchParams.set('validation_status', filters.validationStatus);
      }
      if (filters.isVerified !== undefined) {
        url.searchParams.set('is_verified', String(filters.isVerified));
      }
      if (filters.couponType && filters.couponType !== 'all') {
        url.searchParams.set('coupon_type', filters.couponType);
      }
      if (filters.search) {
        url.searchParams.set('search', filters.search);
      }
      if (filters.limit) {
        url.searchParams.set('limit', String(filters.limit));
      }

      const res = await fetch(url.toString());
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Falha ao buscar cupons detectados');
      }
      return res.json();
    },
    staleTime: 30000, // 30 segundos de cache
    refetchOnWindowFocus: true
  });
}
