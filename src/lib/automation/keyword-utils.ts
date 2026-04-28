/**
 * Utilitários compartilhados para o Radar Pro (Multi-Keyword).
 * Garante consistência entre a execução no Worker e o Preview na UI.
 */

export interface AutomationKeyword {
  term: string;
  weight: number;
  aliases?: string[];
  last_used_at?: string;
}

/**
 * Normaliza as keywords de uma configuração, garantindo fallback para searchTerm.
 */
export function normalizeKeywords(config: any): AutomationKeyword[] {
  if (config.keywords && Array.isArray(config.keywords) && config.keywords.length > 0) {
    return config.keywords.slice(0, 5).map((kw: any) => ({
      term: kw.term || '',
      weight: Number(kw.weight) || 1,
      aliases: Array.isArray(kw.aliases) ? kw.aliases.map((a: any) => String(a)) : [],
      last_used_at: kw.last_used_at
    }));
  }

  // Fallback Legado
  const term = config.searchTerm || '';
  if (!term) return [];
  
  return [{ term, weight: 1, aliases: [] }];
}

/**
 * Retorna o budget total baseado no preset ou valor customizado.
 */
export function getBudgetByPreset(preset: string, customLimit?: number): number {
  if (preset === 'aggressive') return 30;
  if (preset === 'conservative') return 10;
  if (preset === 'balanced') return 20;
  return customLimit || 20;
}

/**
 * Calcula a distribuição de budget entre as keywords.
 * Regra: Proporcional com floor + Piso de 10 por keyword.
 * Se o total de mínimos exceder o budget, divide igualmente com floor.
 */
export function calculateKeywordBudgets(totalBudget: number, keywords: AutomationKeyword[]): number[] {
  const minPerKeyword = 10;
  const count = keywords.length;
  if (count === 0) return [];

  // 1. EDGE CASE CRÍTICO: Se a soma dos mínimos estoura o budget
  if (count * minPerKeyword > totalBudget) {
    const share = Math.floor(totalBudget / count);
    return new Array(count).fill(share);
  }

  // 2. PROPORCIONAL COM FLOOR
  const totalWeight = keywords.reduce((sum, k) => sum + (k.weight || 1), 0);
  let budgets = keywords.map(k => Math.floor(((k.weight || 1) / totalWeight) * totalBudget));

  // 3. APLICAÇÃO DO MÍNIMO (10)
  for (let i = 0; i < budgets.length; i++) {
    if (budgets[i] < minPerKeyword) budgets[i] = minPerKeyword;
  }

  // 4. GUARDA-REDE: Garantir que a soma nunca ultrapassa o totalBudget
  let currentSum = budgets.reduce((a, b) => a + b, 0);
  if (currentSum > totalBudget) {
    const excess = currentSum - totalBudget;
    const indicesAboveMin = budgets.map((b, i) => b > minPerKeyword ? i : -1).filter(i => i !== -1);
    const weightAboveMin = indicesAboveMin.reduce((sum, i) => sum + (keywords[i].weight || 1), 0);

    if (weightAboveMin > 0) {
      for (const idx of indicesAboveMin) {
        const reduction = Math.floor(((keywords[idx].weight || 1) / weightAboveMin) * excess);
        budgets[idx] -= reduction;
      }
      
      currentSum = budgets.reduce((a, b) => a + b, 0);
      if (currentSum > totalBudget) {
        const sortedIndices = indicesAboveMin.sort((a, b) => keywords[b].weight - keywords[a].weight);
        let finalExcess = currentSum - totalBudget;
        for (let i = 0; i < finalExcess; i++) {
          const idx = sortedIndices[i % sortedIndices.length];
          if (budgets[idx] > minPerKeyword) budgets[idx]--;
        }
      }
    }
  }

  return budgets;
}

/**
 * Normaliza o texto para busca relaxada (lowercase, sem acentos, apenas alfanuméricos e espaços).
 */
function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Gera variantes morfológicas básicas (singular/plural) para um termo.
 * Foco em PT-BR e EN.
 */
function getTermVariants(term: string): string[] {
  if (!term || term.length < 3) return [term];
  
  const variants = new Set<string>([term]);
  
  // Regras Simples de Plural/Singular (PT/EN)
  if (term.endsWith('s')) {
    // Provável Plural
    variants.add(term.slice(0, -1)); // notebooks -> notebook
    if (term.endsWith('es')) {
      variants.add(term.slice(0, -2)); // ares -> ar
    }
    if (term.endsWith('ns')) {
      variants.add(term.slice(0, -2) + 'm'); // itens -> item
    }
  } else {
    // Provável Singular
    variants.add(term + 's'); // notebook -> notebooks
    if (term.endsWith('m')) {
      variants.add(term.slice(0, -1) + 'ns'); // item -> itens
    }
    if (term.endsWith('r') || term.endsWith('z')) {
      variants.add(term + 'es'); // ar -> ares
    }
  }
  
  return Array.from(variants);
}

/**
 * HARD FILTER: Verifica de forma determinística se a keyword (ou seus aliases) está presente no título.
 * - Simples: Match direto ou por variantes (singular/plural).
 * - Composta: Contém o termo mais longo OU metade dos tokens.
 */
export function hasKeywordMatch(title: string, keyword: string, aliases: string[] = []): boolean {
  if (!title || !keyword) return false;
  
  const normTitle = normalizeText(title);
  
  // Lista de todos os termos a testar (keyword principal + aliases)
  const allTerms = [keyword, ...aliases].filter(Boolean);

  for (const term of allTerms) {
    const normKeyword = normalizeText(term);
    if (!normKeyword) continue;

    // 1. Tenta match exato (termo inteiro)
    if (normTitle.includes(normKeyword)) return true;
    
    // 2. Tenta match por variantes do termo inteiro
    const kwVariants = getTermVariants(normKeyword);
    for (const v of kwVariants) {
      if (normTitle.includes(v)) return true;
    }
    
    // 3. Extrai tokens relevantes do termo
    const kwTokens = normKeyword.split(/\s+/).filter(t => t.length >= 3);
    
    if (kwTokens.length === 0) {
      const fallbackTokens = normKeyword.split(/\s+/).filter(t => t.length > 0);
      if (fallbackTokens.length > 0) {
        const found = fallbackTokens.some(t => {
          const variants = getTermVariants(t);
          return variants.some(v => normTitle.includes(v));
        });
        if (found) return true;
      }
      continue;
    }
    
    if (kwTokens.length === 1) {
      const variants = getTermVariants(kwTokens[0]);
      if (variants.some(v => normTitle.includes(v))) return true;
      continue;
    }
    
    // 4. Termo composto: Regra 1 - Termo mais longo (ou sua variante) presente
    const longestToken = [...kwTokens].sort((a, b) => b.length - a.length)[0];
    const longestVariants = getTermVariants(longestToken);
    if (longestVariants.some(v => normTitle.includes(v))) return true;
    
    // 5. Termo composto: Regra 2 - Match de pelo menos metade dos tokens (ou suas variantes)
    let matches = 0;
    for (const token of kwTokens) {
      const variants = getTermVariants(token);
      if (variants.some(v => normTitle.includes(v))) {
        matches++;
      }
    }
    
    if (matches >= Math.ceil(kwTokens.length / 2)) return true;
  }
  
  return false;
}
