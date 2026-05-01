import { useQuery } from '@tanstack/react-query';
import { ShopeeOfferNode } from '@/lib/shopee-affiliate/client';

export interface ShopeeOffer extends ShopeeOfferNode {
  commissionPercent: number;
  periodEndFormatted: string | null;
}

export interface OffersResponse {
  status: string;
  queryUsed: string;
  offers: ShopeeOffer[];
  pageInfo: {
    page: number;
    limit: number;
    hasNextPage: boolean;
  };
  testedAt: string;
}

export function useShopeeOffers(keyword?: string) {
  return useQuery<OffersResponse, Error>({
    queryKey: ['shopee-offers', keyword],
    queryFn: async () => {
      const url = new URL('/api/shopee/offers', window.location.origin);
      if (keyword) {
        url.searchParams.set('keyword', keyword);
      }
      
      const res = await fetch(url.toString());
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Falha ao buscar campanhas Shopee');
      }
      
      return res.json();
    },
    refetchInterval: () => {
      // 5 minutos base + jitter de ±30s
      const jitter = Math.floor(Math.random() * 60000) - 30000;
      return 300000 + jitter;
    },
    staleTime: 240000, // 4 minutos
  });
}
