// src/hooks/use-products.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productService } from '@/services/supabase/product-service';
import { ProductFilter } from '@/types/product';

export function useProducts(filters: ProductFilter & { enabled?: boolean } = {}) {
  const { enabled = true, ...rest } = filters;
  
  return useQuery({
    queryKey: ['products', rest],
    queryFn: () => productService.list(rest),
    enabled,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => productService.getById(id),
    enabled: !!id,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
      productService.toggleFavorite(id, isFavorite),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
