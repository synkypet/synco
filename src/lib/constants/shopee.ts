
export const SHOPEE_SORT_TYPE = {
  RELEVANCE: 1,
  BEST_SELLERS: 2,
  TOP_COMMISSION: 5,
} as const;

export type ShopeeSortType = typeof SHOPEE_SORT_TYPE[keyof typeof SHOPEE_SORT_TYPE];

export const SHOPEE_SORT_TYPE_LABELS: Record<ShopeeSortType, string> = {
  [SHOPEE_SORT_TYPE.RELEVANCE]: "Relevância",
  [SHOPEE_SORT_TYPE.BEST_SELLERS]: "Mais Vendidos",
  [SHOPEE_SORT_TYPE.TOP_COMMISSION]: "Maior Comissão",
};

export const SHOPEE_LIST_TYPE = {
  DEFAULT: 0,
  PROMOTION: 1,
} as const;

export type ShopeeListType = typeof SHOPEE_LIST_TYPE[keyof typeof SHOPEE_LIST_TYPE];

export const SHOPEE_LIST_TYPE_LABELS: Record<ShopeeListType, string> = {
  [SHOPEE_LIST_TYPE.DEFAULT]: "Padrão",
  [SHOPEE_LIST_TYPE.PROMOTION]: "Em Promoção",
};
