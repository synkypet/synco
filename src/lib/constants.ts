// src/lib/constants.ts

export const CATEGORY_LABELS: Record<string, string> = {
  eletronicos: "Eletrônicos",
  casa_cozinha: "Casa & Cozinha",
  moda: "Moda",
  beleza: "Beleza",
  esportes: "Esportes",
  brinquedos: "Brinquedos",
  automotivo: "Automotivo",
  pets: "Pets",
  saude: "Saúde",
  papelaria: "Papelaria",
  ferramentas: "Ferramentas",
  alimentos: "Alimentos",
};

export const SAVED_FILTERS = [
  { name: "Comissão Alta", rules: { minCommission: 10 } },
  { name: "Produtos até 50 reais", rules: { maxPrice: 50 } },
  { name: "Cupom Forte", rules: { has_coupon: true, minDiscount: 50 } },
  { name: "Casa e Cozinha", rules: { category: "casa_cozinha" } },
  { name: "Eletrônicos", rules: { category: "eletronicos" } },
  { name: "Frete Grátis + Desconto", rules: { free_shipping: true, minDiscount: 40 } },
  { name: "Score Alto", rules: { minScore: 85 } },
];

export const MARKETPLACE_TABS = [
  { value: 'all', label: 'Todos' },
  { value: 'Shopee', label: '🛍️ Shopee' },
  { value: 'Mercado Livre', label: '🛒 Mercado Livre' },
  { value: 'Amazon', label: '📦 Amazon' },
  { value: 'Magalu', label: '🏪 Magalu' },
  { value: 'AliExpress', label: '🌏 AliExpress' },
  { value: 'Shein', label: '👗 Shein' },
];

export const OFFER_TABS = [
  { value: 'all', label: 'Em Alta' },
  { value: 'opportunities', label: 'Oportunidades' },
  { value: 'high_commission', label: 'Maior Comissão' },
  { value: 'low_price', label: 'Menor Preço' },
  { value: 'coupons', label: 'Cupons' },
  { value: 'favorites', label: 'Favoritos' },
];

export const SORT_OPTIONS = [
  { value: 'score_desc', label: 'Melhor Oportunidade' },
  { value: 'commission_desc', label: 'Maior Comissão %' },
  { value: 'commission_asc', label: 'Menor Comissão %' },
  { value: 'commission_value_desc', label: 'Maior Comissão R$' },
  { value: 'price_asc', label: 'Menor Preço' },
  { value: 'price_desc', label: 'Maior Preço' },
  { value: 'discount_desc', label: 'Maior Desconto' },
  { value: 'sales_desc', label: 'Mais Vendidos' },
  { value: 'rating_desc', label: 'Melhor Nota' },
];
