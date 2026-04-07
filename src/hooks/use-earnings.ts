// src/hooks/use-earnings.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { earningsService } from '@/services/supabase/earnings-service';
import { toast } from 'sonner';

export function useEarningsSummary() {
  return useQuery({
    queryKey: ['earnings-summary'],
    queryFn: () => earningsService.getEarningsSummary(),
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
