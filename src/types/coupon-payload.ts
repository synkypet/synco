// src/types/coupon-payload.ts

export interface CouponPayload {
  couponId: string;
  inputUrl: string;
  couponCode: string | null;
  couponLabel: string | null;
  couponType: string | null;
  redemptionUrl: string | null;
  sourceUrl: string | null;
}
