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
  enabled?: boolean;
  debug?: boolean;
  onlyVerified?: boolean;
}

/**
 * Hook para buscar cupons detectados pelo radar.
 */
export function useDiscoveredCoupons(filters: DiscoveredCouponsFilters = {}) {
  const { enabled = true, debug = false, onlyVerified = false, ...rest } = filters;

  return useQuery<DiscoveredCouponsResponse, Error>({
    queryKey: ['shopee-discovered-coupons', { ...rest, debug, onlyVerified }],
    queryFn: async () => {
      const url = new URL('/api/shopee/discovered-coupons', window.location.origin);
      
      if (rest.status && rest.status !== 'all') {
        url.searchParams.set('status', rest.status);
      }
      if (rest.validationStatus && rest.validationStatus !== 'all') {
        url.searchParams.set('validation_status', rest.validationStatus);
      }
      if (rest.isVerified !== undefined) {
        url.searchParams.set('is_verified', String(rest.isVerified));
      }
      if (rest.couponType && rest.couponType !== 'all') {
        url.searchParams.set('coupon_type', rest.couponType);
      }
      if (rest.search) {
        url.searchParams.set('search', rest.search);
      }
      if (rest.limit) {
        url.searchParams.set('limit', String(rest.limit));
      }
      if (debug) {
        url.searchParams.set('debug', '1');
      }
      if (onlyVerified) {
        url.searchParams.set('onlyVerified', '1');
      }

      const res = await fetch(url.toString());
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Falha ao buscar cupons detectados');
      }
      return res.json();
    },
    enabled,
    staleTime: 30000, // 30 segundos de cache
    refetchOnWindowFocus: true
  });
}
