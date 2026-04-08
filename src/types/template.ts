export type TemplateCategory = 
  | 'promo' 
  | 'coupon' 
  | 'launch' 
  | 'flash' 
  | 'comparison' 
  | 'review' 
  | 'general';

export interface Template {
  id: string;
  user_id: string;
  name: string;
  content: string;
  category: TemplateCategory;
  usage_count: number;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  promo: 'Promoção',
  coupon: 'Cupom',
  launch: 'Lançamento',
  flash: 'Relâmpago',
  comparison: 'Comparação',
  review: 'Review',
  general: 'Geral'
};
