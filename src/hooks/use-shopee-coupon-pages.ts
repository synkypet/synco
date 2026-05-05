
import { useQuery } from '@tanstack/react-query';

export interface ShopeeCouponPage {
  id: string;
  name: string;
  original_url: string;
  short_link: string;
  image_url: string | null;
  is_active: boolean;
  last_refreshed_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export function useShopeeCouponPages() {
  return useQuery<ShopeeCouponPage[], Error>({
    queryKey: ['shopee-coupon-pages'],
    queryFn: async () => {
      const res = await fetch('/api/coupon/pages');
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Falha ao buscar páginas de cupons');
      }
      return res.json();
    },
    staleTime: 600000, // 10 minutos
  });
}
