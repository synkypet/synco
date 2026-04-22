import { useQuery } from '@tanstack/react-query';
import { AccessResolution } from '@/types/billing';

/**
 * Hook central de Acesso e Billing (Fase 3).
 * Consome a rota oficial /api/user/access para determinar o estado do usuário na UI.
 */
export function useAccess() {
  const { data, isLoading, error, refetch } = useQuery<AccessResolution & { userId: string }>({
    queryKey: ['user-access'],
    queryFn: async () => {
      const res = await fetch('/api/user/access');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao carregar status de acesso');
      }
      return res.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutos de cache (Billing não muda com frequência)
    gcTime: 1000 * 60 * 30,    // Mantém em memória por 30m
    retry: 1,
  });

  return {
    access: data,
    isLoading,
    error,
    refetch,

    // Helpers de Estado Operacional
    isOperative: data?.isOperative ?? false,
    
    // Status Específicos
    isInternal: data?.status === 'internal_license',
    isTrial: data?.status === 'trial',
    isActive: data?.status === 'active_subscription',
    isRestricted: data?.status === 'past_due_restricted',
    isBlocked: data?.status === 'expired_blocked' || data?.status === 'no_subscription',
    
    // Nome amigável do status
    statusLabel: getStatusLabel(data?.status),
    
    // Quotas e Features
    quotas: data?.quotas,
    features: data?.features,
    planName: data?.planName || 'Sem Plano'
  };
}

function getStatusLabel(status?: string) {
  switch (status) {
    case 'internal_license': return 'Licença Interna';
    case 'active_subscription': return 'Assinatura Ativa';
    case 'trial': return 'Período de Teste';
    case 'past_due_restricted': return 'Pagamento Pendente';
    case 'expired_blocked': return 'Assinatura Expirada';
    case 'no_subscription': return 'Sem Assinatura';
    default: return 'Verificando...';
  }
}
