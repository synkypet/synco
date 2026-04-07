// src/types/product.ts

export interface Product {
  id: string;
  name: string;
  description?: string;
  marketplace: string;
  category?: string;
  original_url: string;
  image_url?: string;
  original_price?: number;
  current_price?: number;
  discount_percent?: number;
  commission_percent?: number;
  commission_value?: number;
  coupon?: string;
  is_favorite: boolean;
  rating?: number;
  sales_count?: number;
  opportunity_score?: number;
  free_shipping: boolean;
  official_store: boolean;
  already_sent: boolean;
  created_at?: string;
  updated_at?: string;
  // UI/Mock fields
  tags?: string[];
  store_name?: string;
  status?: string;
}

export type ProductFilter = {
  marketplace?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minDiscount?: number;
  minCommission?: number;
  minScore?: number;
  search?: string;
};
