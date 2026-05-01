import { useQuery } from '@tanstack/react-query';
import { ProductNode } from '@/lib/shopee-affiliate/types';

export interface CampaignProduct extends Omit<ProductNode, 'priceDiscountRate' | 'sales'> {
  commissionPercent: number;
  priceParsed: number;
  originalPriceParsed: number;
  priceDiscountRate: number;
  sales: number;
}

export function useCampaignProducts(keyword: string | null) {
  const { data, isLoading, isError, error, isFetching, refetch } = useQuery<{ products: CampaignProduct[] }>({
    queryKey: ['campaign-products', keyword],
    queryFn: async () => {
      if (!keyword) return { products: [] };
      const response = await fetch(`/api/shopee/campaign-products?keyword=${encodeURIComponent(keyword)}`);
      
      if (!response.ok) {
        let msg = `Erro HTTP: ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.error) msg = errData.error;
        } catch {}
        throw new Error(msg);
      }
      
      return response.json();
    },
    enabled: !!keyword,
    staleTime: 5 * 60 * 1000,
  });

  return {
    products: data?.products || [],
    isLoading: isLoading && isFetching,
    isError,
    error: error as Error | null,
    refetch
  };
}
