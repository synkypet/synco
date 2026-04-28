import { useQuery } from '@tanstack/react-query';
import { AccessResolution } from '@/types/billing';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook central de Acesso e Billing (Fase 3).
 * Consome a rota oficial /api/user/access para determinar o estado do usuário na UI.
 */
export function useAccess() {
  const { user } = useAuth();
  
  const { data, isLoading, error, refetch } = useQuery<AccessResolution & { userId: string }>({
    queryKey: ['user-access', user?.id],
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
    // Status Específicos
    isInternal: data?.status === 'internal_license',
    isTrial: data?.status === 'trialing',
    isActive: data?.status === 'active',
    isRestricted: data?.status === 'past_due_restricted' || data?.status === 'canceled',
    isBlocked: data?.status === 'expired_blocked' || data?.status === 'none' || data?.status === 'expired',
    
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
    case 'active': return 'Assinatura Ativa';
    case 'trialing': return 'Período de Teste';
    case 'past_due': return 'Em Atraso (Tolerância)';
    case 'past_due_restricted': return 'Pagamento Pendente';
    case 'canceled': return 'Cancelada';
    case 'expired': return 'Expirada';
    case 'expired_blocked': return 'Assinatura Expirada';
    case 'none': return 'Sem Assinatura';
    default: return 'Verificando...';
  }
}
