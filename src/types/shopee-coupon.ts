
export type ShopeeCouponType = 'codigo' | 'link_resgate' | 'pagina_cupons' | 'pagina_oferta' | 'monetary_discount';
export type ShopeeCouponStatus = 'candidate' | 'valid' | 'unknown' | 'expired';

export interface ShopeeCoupon {
  marketplace: 'shopee';
  type: ShopeeCouponType;
  code: string | null;
  couponLabel: string | null;
  redemptionUrl: string | null;
  confidence: number;
  confidenceLevel?: 'high' | 'medium' | 'low';
  source?: 'explicit_label' | 'emoji_line' | 'nearby_text' | 'discount_label' | 'central_page';
  status: ShopeeCouponStatus;
  dedupeKey: string;
}

export interface CouponExtractionResult {
  coupons: ShopeeCoupon[];
  rawText: string;
  processedAt: string;
}
