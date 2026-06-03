export async function canUseSyncoMetrics(userId: string): Promise<boolean> {
  // TODO: Conectar no futuro com o módulo de billing/plans.
  // Por enquanto, placeholder MVP que permite a todos.
  return true;
}

export const SYNCO_METRICS_LIMIT = 3;
