// src/hooks/use-earnings.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { earningsService } from '@/services/supabase/earnings-service';
import { toast } from 'sonner';

const PERIOD_MAP: Record<string, number> = {
  today: 1,
  week: 7,
  '15d': 15,
  '30d': 30,
  month: 30,
};

export function useEarningsSummary(userId: string | undefined, options: { period?: string; startDate?: string; endDate?: string } = { period: 'week' }) {
  const { period = 'week', startDate, endDate } = options;
  
  // Calculate effective startDate if period is provided but startDate is not
  let effectiveStartDate = startDate;
  if (!effectiveStartDate && period && PERIOD_MAP[period]) {
    const days = PERIOD_MAP[period];
    const date = new Date();
    date.setDate(date.getDate() - days);
    effectiveStartDate = date.toISOString();
  }

  return useQuery({
    queryKey: ['earnings-summary', userId, period, startDate, endDate],
    queryFn: () => userId ? earningsService.getEarningsSummary(userId, { startDate: effectiveStartDate, endDate }) : Promise.reject('User ID required'),
    enabled: !!userId,
  });
}

export function useImportHistory() {
  return useQuery({
    queryKey: ['earnings-history'],
    queryFn: () => earningsService.getImportHistory(),
  });
}

export function useImportShopee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fileContent: string) => earningsService.importShopeeCSV(fileContent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['earnings-summary'] });
      queryClient.invalidateQueries({ queryKey: ['earnings-history'] });
      toast.success('Relatório da Shopee importado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao importar relatório: ${error.message}`);
    },
  });
}
