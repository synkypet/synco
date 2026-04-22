// src/lib/marketplaces/shopee/categories.ts

/**
 * Mapeamento das principais categorias da Shopee Brasil (Nível 1).
 * IDs baseados na taxonomia da Open API.
 */
export const SHOPEE_CATEGORIES: Record<number, string> = {
  100001: 'Moda Feminina',
  100002: 'Moda Masculina',
  100003: 'Beleza e Cuidado Pessoal',
  100004: 'Casa e Decoração',
  100005: 'Eletrônicos',
  100006: 'Celulares e Dispositivos',
  100007: 'Brinquedos e Hobbies',
  100008: 'Esporte e Lazer',
  100009: 'Bebês',
  100010: 'Alimentos e Bebidas',
  100011: 'Papelaria',
  100012: 'Calçados',
  100013: 'Bolsas e Acessórios',
  100014: 'Saúde e Bem Estar',
  100015: 'Automotivo',
  100016: 'Pet Shop',
  100017: 'Instrumentos Musicais',
  100018: 'Eletroportáteis',
  100019: 'Informática',
  100020: 'Games e Consoles',
  100021: 'Livros e Revistas',
  100022: 'Relógios',
  100023: 'Joalheria e Bijuteria',
  100024: 'Câmeras',
};

/**
 * Retorna o nome da categoria com base em uma lista de IDs.
 * Geralmente o primeiro ID do array `productCatIds` é a categoria principal.
 */
export function getCategoryName(catIds: number[]): string {
  if (!catIds || catIds.length === 0) return 'Geral';
  for (const id of catIds) {
    if (SHOPEE_CATEGORIES[id]) return SHOPEE_CATEGORIES[id];
  }
  return 'Geral';
}
