'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMarketplaceCatalog, useUserMarketplaceConnections, useUpsertMarketplaceConnection } from '@/hooks/use-marketplaces';
import { MarketplaceCard } from './MarketplaceCard';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function MarketplaceGrid() {
  const { user } = useAuth();
  const { 
    data: catalog, 
    isLoading: isLoadingCatalog, 
    isError: isErrorCatalog,
    refetch: refetchCatalog 
  } = useMarketplaceCatalog();
  
  const { 
    data: connections, 
    isLoading: isLoadingConnections,
    isError: isErrorConnections,
    refetch: refetchConnections
  } = useUserMarketplaceConnections(user?.id);
  
  const { mutate: upsertConnection, isPending: isSaving } = useUpsertMarketplaceConnection();

  const handleRetry = () => {
    refetchCatalog();
    refetchConnections();
  };

  if (isLoadingCatalog || isLoadingConnections) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-[220px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isErrorCatalog || isErrorConnections) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 bg-red-50/50 rounded-2xl border-2 border-red-100 border-dashed">
        <div className="p-3 bg-red-100 rounded-full text-red-600">
          <AlertCircle size={32} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-red-700">Erro ao carregar marketplaces</h3>
          <p className="text-sm text-red-500 max-w-xs mx-auto">
            Não foi possível estabelecer conexão com o catálogo do Supabase.
          </p>
        </div>
        <Button variant="outline" onClick={handleRetry} className="gap-2">
          <RefreshCw size={16} /> Tentar Novamente
        </Button>
      </div>
    );
  }

  const handleToggle = (marketplaceId: string, active: boolean) => {
    if (!user) return;
    
    // Busca conexão existente para não perder o affiliate_id ao desativar/reativar
    const existing = connections?.find(c => c.marketplace_id === marketplaceId);
    
    upsertConnection({
      user_id: user.id,
      marketplace_id: marketplaceId,
      is_active: active,
      affiliate_id: existing?.affiliate_id || ''
    });
  };

  const handleSave = (marketplaceId: string, data: any) => {
    if (!user) return;
    
    upsertConnection({
      user_id: user.id,
      marketplace_id: marketplaceId,
      ...data
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
      {catalog?.map((marketplace) => {
        const connection = connections?.find(c => c.marketplace_id === marketplace.id);
        return (
          <MarketplaceCard
            key={marketplace.id}
            marketplace={marketplace}
            connection={connection}
            onToggle={(active) => handleToggle(marketplace.id, active)}
            onSave={(data) => handleSave(marketplace.id, data)}
            isSaving={isSaving}
          />
        );
      })}
    </div>
  );
}
