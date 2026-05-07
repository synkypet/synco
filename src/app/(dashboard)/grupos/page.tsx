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
import { OperationalAccessBanner } from '@/components/billing/OperationalAccessBanner';

export default function GruposPage() {
  const { user } = useAuth();
  const { data: groups, isLoading: isLoadingGroups, isError: isErrorGroups, refetch: refetchGroups } = useGroups(user?.id);
  const { data: channels, isLoading: isLoadingChannels } = useChannels(user?.id);

  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleSyncAll = async () => {
    if (!channels || channels.length === 0) {
      toast.error('Nenhum canal de WhatsApp conectado para buscar grupos.');
      return;
    }

    setIsSyncingAll(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const channel of channels) {
        if (channel.status !== 'active') continue;

        try {
          const res = await fetch('/api/wasender/groups/sync', {
            method: 'POST',
            body: JSON.stringify({ channel_id: channel.id })
          });
          if (res.ok) successCount++;
          else failCount++;
        } catch (err) {
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} canal(ais) atualizado(s) com sucesso!`);
        refetchGroups();
      } else if (failCount > 0) {
        toast.error('Não foi possível atualizar os grupos agora. Verifique sua conexão.');
      }
    } finally {
      setIsSyncingAll(false);
    }
  };

  const filteredGroups = groups?.filter(group => {
    return group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.description?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const isLoading = isLoadingGroups || isLoadingChannels;

  // Lógica de Paginação Client-Side
  const filteredLength = filteredGroups?.length || 0;
  const totalPages = Math.ceil(filteredLength / ITEMS_PER_PAGE);
  const paginatedGroups = filteredGroups?.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  ) || [];

  return (
    <LayoutContainer type="operational">
      <OperationalAccessBanner />
      <PageHeader
        title="Grupos"
        description="Todos os grupos do WhatsApp conectados à sua conta"
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
              {isSyncingAll ? 'Buscando...' : 'Buscar grupos no WhatsApp'}
            </KineticButton>
          </div>
        }
      />

      <div className="flex items-center gap-4 bg-anthracite-surface p-4 rounded-2xl border-none shadow-skeuo-flat mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={18} />
          <Input
            placeholder="Buscar por nome ou descrição..."
            className="pl-10 bg-white/5 border-none shadow-skeuo-pressed"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[80px] w-full rounded-2xl bg-white/5" />
          <Skeleton className="h-[80px] w-full rounded-2xl bg-white/5" />
          <Skeleton className="h-[80px] w-full rounded-2xl bg-white/5" />
        </div>
      ) : isErrorGroups ? (
        <div className="p-12 text-center bg-red-500/5 rounded-[40px] shadow-skeuo-pressed">
          <p className="text-red-500 font-black uppercase tracking-widest text-sm italic">Não foi possível carregar os grupos</p>
          <p className="text-white/20 text-xs mt-1">Não foi possível atualizar os grupos agora. Verifique se seu WhatsApp está conectado e tente novamente.</p>
          <KineticButton onClick={() => refetchGroups()} className="text-kinetic-orange mt-4 uppercase font-bold text-[10px] tracking-widest bg-transparent shadow-none">Tentar novamente</KineticButton>
        </div>
      ) : (
        <div className="space-y-6">
          <GroupList
            groups={paginatedGroups}
            isLoading={isLoading}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white/5 p-4 rounded-2xl shadow-skeuo-flat">
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-black">
                Página {currentPage} de {totalPages} ({filteredLength} grupos encontrados)
              </span>
              <div className="flex items-center gap-2">
                <KineticButton
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="bg-deep-void shadow-skeuo-pressed h-8 px-4 border-none text-[10px] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Anterior
                </KineticButton>
                <KineticButton
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="bg-deep-void shadow-skeuo-pressed h-8 px-4 border-none text-[10px] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Próximo
                </KineticButton>
              </div>
            </div>
          )}
        </div>
      )}
    </LayoutContainer>
  );
}
