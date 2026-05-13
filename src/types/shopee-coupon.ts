
export type ShopeeCouponType = 'codigo' | 'link_resgate' | 'pagina_cupons';
export type ShopeeCouponStatus = 'candidate' | 'valid' | 'unknown' | 'expired';

export interface ShopeeCoupon {
  marketplace: 'shopee';
  type: ShopeeCouponType;
  code: string | null;
  couponLabel: string | null;
  redemptionUrl: string | null;
  confidence: number;
  status: ShopeeCouponStatus;
  dedupeKey: string;
}

export interface CouponExtractionResult {
  coupons: ShopeeCoupon[];
  rawText: string;
  processedAt: string;
}
