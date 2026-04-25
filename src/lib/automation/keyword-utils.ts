/**
 * Utilitários compartilhados para o Radar Pro (Multi-Keyword).
 * Garante consistência entre a execução no Worker e o Preview na UI.
 */

export interface AutomationKeyword {
  term: string;
  weight: number;
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
      last_used_at: kw.last_used_at
    }));
  }

  // Fallback Legado
  const term = config.searchTerm || '';
  if (!term) return [];
  
  return [{ term, weight: 1 }];
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
