
export type ShopeeContentType = 
  | 'verified_coupon'   // Cupom real com evidência forte (código/página + link)
  | 'product_offer'      // Oferta de produto com preço/detalhes
  | 'product_link'       // Apenas link de produto sem detalhes
  | 'promo_landing'      // Página promocional (ex: Super Ofertas)
  | 'candidate'          // Possível cupom mas falta link ou validação
  | 'unknown'            // Inconclusivo
  | 'rejected';          // Descartado categoricamente

export interface ShopeeClassificationResult {
  content_type: ShopeeContentType;
  confidence: number; // 0 a 100
  reasons: string[];
  coupon_code?: string;
  redemption_url?: string;
  has_valid_link: boolean;
  validation_depth: 'signals_only';
  debug?: {
    explicit_code_raw?: string;
    explicit_code_normalized?: string;
    explicit_code_accepted: boolean;
    explicit_code_reject_reason?: string;
    signals?: any;
    hints?: any;
  };
}

export interface ShopeeClassifierInput {
  text?: string;
  title?: string;
  code?: string;
  coupon_label?: string;
  redemption_url?: string;
  source_url?: string;
  price?: number | null;
}
