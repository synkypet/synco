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
  const [activeFilter, setActiveFilter] = useState<'all' | 'admin' | 'owner' | 'operable' | 'readonly'>('all');

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

  const filteredGroups = groups?.filter(group => {
    const matchesSearch = group.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          group.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    const channelPhone = group.channel_config?.phoneNumber?.replace(/\D/g, '') || '';
    const groupOwner = group.owner?.split('@')[0] || '';
    const isOwner = !!(channelPhone && groupOwner && (channelPhone === groupOwner || channelPhone.endsWith(groupOwner) || groupOwner.endsWith(channelPhone)));
    
    // Fallback de aproximação já que a malha não é toda persistida
    const isAnnouncement = group.permissions?.announcement === true;

    switch (activeFilter) {
        case 'admin':
            // Aproximação: Considerar admin se for owner ou no futuro salvar essa flag
            return isOwner; // Temporário até persistirmos isAdmin bool localmente para a lista
        case 'owner':
            return isOwner;
        case 'operable':
            return isOwner || !isAnnouncement;
        case 'readonly':
            return !isOwner && isAnnouncement;
        case 'all':
        default:
            return true;
    }
  });

  const isLoading = isLoadingGroups || isLoadingChannels;

  return (
    <LayoutContainer type="operational">
      <PageHeader 
        title="Grupos"
        description="Espelho operacional da malha de grupos sincronizada via WasenderAPI."
        icon={<Users size={24} />}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full shadow-skeuo-pressed border-none">
              <Users size={14} className="text-kinetic-orange" />
              <span className="text-[10px] font-black text-white/90 uppercase tracking-widest">
                {groups?.length || 0} Total
              </span>
            </div>
            <KineticButton 
              onClick={handleSyncAll} 
              disabled={isSyncingAll || isLoadingChannels}
              className="gap-2 px-6 h-12"
            >
              <RefreshCw size={18} className={isSyncingAll ? "animate-spin" : ""} />
              Sincronizar Canais
            </KineticButton>
          </div>
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
          onClick={() => refetchGroups()} 
          className="shrink-0 h-12 w-12 rounded-xl bg-white/5 border-none shadow-skeuo-flat"
        >
          <RefreshCw size={18} className={isLoading ? "animate-spin text-kinetic-orange" : "text-white/40"} />
        </KineticButton>
      </div>
      
      {/* Filtros Operacionais */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar">
        {[
          { id: 'all', label: 'Todos', count: groups?.length || 0 },
          { id: 'admin', label: 'Sou Admin', count: groups?.filter(g => {
              const channelPhone = g.channel_config?.phoneNumber?.replace(/\D/g, '') || '';
              const groupOwner = g.owner?.split('@')[0] || '';
              return !!(channelPhone && groupOwner && (channelPhone === groupOwner || channelPhone.endsWith(groupOwner) || groupOwner.endsWith(channelPhone)));
            }).length || 0 
          },
          { id: 'owner', label: 'Sou Owner', count: groups?.filter(g => {
              const channelPhone = g.channel_config?.phoneNumber?.replace(/\D/g, '') || '';
              const groupOwner = g.owner?.split('@')[0] || '';
              return !!(channelPhone && groupOwner && (channelPhone === groupOwner || channelPhone.endsWith(groupOwner) || groupOwner.endsWith(channelPhone)));
            }).length || 0
          },
          { id: 'operable', label: 'Operáveis', count: groups?.filter(g => {
              const channelPhone = g.channel_config?.phoneNumber?.replace(/\D/g, '') || '';
              const groupOwner = g.owner?.split('@')[0] || '';
              const isOwner = !!(channelPhone && groupOwner && (channelPhone === groupOwner || channelPhone.endsWith(groupOwner) || groupOwner.endsWith(channelPhone)));
              return isOwner || !g.permissions?.announcement;
            }).length || 0
          },
          { id: 'readonly', label: 'Leitura', count: groups?.filter(g => {
              const channelPhone = g.channel_config?.phoneNumber?.replace(/\D/g, '') || '';
              const groupOwner = g.owner?.split('@')[0] || '';
              const isOwner = !!(channelPhone && groupOwner && (channelPhone === groupOwner || channelPhone.endsWith(groupOwner) || groupOwner.endsWith(channelPhone)));
              return !isOwner && g.permissions?.announcement;
            }).length || 0
          }
        ].map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id as any)}
            className={`flex items-center gap-2 whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${
              activeFilter === filter.id 
                ? 'bg-kinetic-orange text-white shadow-glow-orange' 
                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/80 shadow-skeuo-flat'
            }`}
          >
            {filter.label}
            <span className={`px-1.5 py-0.5 rounded-md text-[9px] ${
              activeFilter === filter.id ? 'bg-white/20 text-white' : 'bg-white/5 text-white/30'
            }`}>
              {filter.count}
            </span>
          </button>
        ))}
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
          <KineticButton onClick={() => refetchGroups()} className="text-kinetic-orange mt-4 uppercase font-bold text-[10px] tracking-widest bg-transparent shadow-none">Tentar novamente</KineticButton>
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
