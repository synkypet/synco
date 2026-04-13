'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGroups } from '@/hooks/use-groups';
import { useChannels } from '@/hooks/use-channels';
import { GroupList } from '@/components/groups/GroupList';
import { Button } from '@/components/ui/button';
import { Users, Search, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import LayoutContainer from '@/components/layout/LayoutContainer';
import PageHeader from '@/components/shared/PageHeader';
import { KineticButton } from '@/components/ui/KineticButton';
import { toast } from 'sonner';

export default function GruposPage() {
  const { user } = useAuth();
  const { data: groups, isLoading: isLoadingGroups, isError: isErrorGroups, refetch: refetchGroups } = useGroups(user?.id);
  const { data: channels, isLoading: isLoadingChannels } = useChannels(user?.id);
  
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSyncAll = async () => {
    if (!channels || channels.length === 0) {
      toast.error('Nenhum canal ativo para sincronizar.');
      return;
    }

    setIsSyncingAll(true);
    let successCount = 0;

    toast.promise(
      Promise.all(channels.map(async (channel) => {
        try {
          const res = await fetch('/api/wasender/groups/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel_id: channel.id })
          });
          if (res.ok) successCount++;
        } catch (e) {
          console.error(`Erro ao sincronizar canal ${channel.name}:`, e);
        }
      })),
      {
        loading: 'Sincronizando malha de todos os canais...',
        success: () => {
          setIsSyncingAll(false);
          refetchGroups();
          return `Sincronização concluída! ${successCount} canais processados.`;
        },
        error: 'Erro parcial na sincronização.'
      }
    );
  };

  const filteredGroups = groups?.filter(group => 
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isLoading = isLoadingGroups || isLoadingChannels;

  return (
    <LayoutContainer type="operational">
      <PageHeader 
        title="Grupos"
        description="Espelho operacional da malha de grupos sincronizada via WasenderAPI."
        icon={<Users size={24} />}
        actions={
          <KineticButton 
            onClick={handleSyncAll} 
            disabled={isSyncingAll || isLoadingChannels}
            className="gap-2 px-6 h-12"
          >
            <RefreshCw size={18} className={isSyncingAll ? "animate-spin" : ""} />
            Sincronizar Canais
          </KineticButton>
        }
      />

      <div className="flex items-center gap-4 bg-anthracite-surface p-4 rounded-2xl border-none shadow-skeuo-flat mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={18} />
          <Input 
            placeholder="Buscar por nome, ID ou descrição..." 
            className="pl-10 bg-white/5 border-none shadow-skeuo-pressed"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <KineticButton 
          variant="flat" 
          size="icon" 
          onClick={() => refetchGroups()} 
          className="shrink-0 h-12 w-12 rounded-xl bg-white/5 border-none shadow-skeuo-flat"
        >
          <RefreshCw size={18} className={isLoading ? "animate-spin text-kinetic-orange" : "text-white/40"} />
        </KineticButton>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[80px] w-full rounded-2xl bg-white/5" />
          <Skeleton className="h-[80px] w-full rounded-2xl bg-white/5" />
          <Skeleton className="h-[80px] w-full rounded-2xl bg-white/5" />
        </div>
      ) : isErrorGroups ? (
        <div className="p-12 text-center bg-red-500/5 rounded-[40px] shadow-skeuo-pressed">
          <p className="text-red-500 font-black uppercase tracking-widest text-sm italic">Erro de Sincronização</p>
          <p className="text-white/20 text-xs mt-1">Não foi possível carregar os dados operacionais dos grupos.</p>
          <KineticButton variant="flat" onClick={() => refetchGroups()} className="text-kinetic-orange mt-4 uppercase font-bold text-[10px] tracking-widest bg-transparent shadow-none">Tentar novamente</KineticButton>
        </div>
      ) : (
        <GroupList 
          groups={filteredGroups || []} 
          isLoading={isLoading}
        />
      )}
    </LayoutContainer>
  );
}
