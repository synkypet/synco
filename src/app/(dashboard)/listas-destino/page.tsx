/* eslint-disable react/no-unescaped-entities */
'use client';

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDestinations, useCreateDestination, useUpdateDestination, useDeleteDestination } from '@/hooks/use-destinations';
import { DestinationList } from '@/components/destinations/DestinationList';
import { DestinationDialog } from '@/components/destinations/DestinationDialog';
import { DestinationList as DestinationType } from '@/types/destination-list';
import { Button } from '@/components/ui/button';
import { Plus, Layers, Search, RefreshCw, Info, Users, Zap, Target } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { TactileCard } from '@/components/ui/TactileCard';
import { StatCard } from '@/components/ui/StatCard';
import LayoutContainer from '@/components/layout/LayoutContainer';
import PageHeader from '@/components/shared/PageHeader';
import { KineticButton } from '@/components/ui/KineticButton';

export default function ListasDestinoPage() {
  const { user } = useAuth();
  const { 
    data: destinations, 
    isLoading: isLoadingDestinations, 
    isError: isErrorDestinations, 
    refetch: refetchDestinations 
  } = useDestinations(user?.id);
  
  const createDest = useCreateDestination();
  const updateDest = useUpdateDestination();
  const deleteDest = useDeleteDestination();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDest, setEditingDest] = useState<DestinationType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Cálculo de estatísticas reais
  const stats = useMemo(() => {
    if (!destinations) return { count: 0, uniqueGroups: 0, totalReach: 0 };
    
    const uniqueGroups = new Set();
    let reach = 0;
    
    destinations.forEach(list => {
      list.groups?.forEach(g => {
        uniqueGroups.add(g.id);
        // Evitar contagem duplicada de membros para "alcance real" (único)
        // Mas o usuário pediu "alcance total", que geralmente é a soma das listas no dashboard
      });
    });

    // Para o alcance total, vamos somar o alcance de cada lista individualmente
    const totalReach = destinations.reduce((sum, list) => {
      return sum + (list.groups?.reduce((s, g) => s + (g.members_count || 0), 0) || 0);
    }, 0);

    return {
      count: destinations.length,
      uniqueGroups: uniqueGroups.size,
      totalReach
    };
  }, [destinations]);

  const handleCreate = () => {
    setEditingDest(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (dest: DestinationType) => {
    setEditingDest(dest);
    setIsDialogOpen(true);
  };

  const handleDelete = (dest: DestinationType) => {
    if (window.confirm(`Tem certeza que deseja excluir a lista "${dest.name}"?`)) {
      const promise = deleteDest.mutateAsync({ id: dest.id, user_id: user?.id as string });
      toast.promise(promise, {
        loading: 'Excluindo lista...',
        success: 'Lista removida.',
        error: 'Erro ao excluir.'
      });
    }
  };

  const handleSubmit = (data: any) => {
    const { groupIds, ...destinationData } = data;
    
    if (editingDest) {
      const promise = updateDest.mutateAsync({
        id: editingDest.id,
        user_id: user?.id as string,
        destination: destinationData,
        groupIds: groupIds,
      });

      toast.promise(promise, {
        loading: 'Atualizando lista...',
        success: () => {
          setIsDialogOpen(false);
          return 'Lista atualizada com sucesso!';
        },
        error: (err) => `Erro ao atualizar lista: ${err.message}`
      });
    } else {
      const promise = createDest.mutateAsync({
        destination: {
          user_id: user?.id as string,
          ...destinationData,
          is_active: true
        },
        groupIds: groupIds || [],
      });

      toast.promise(promise, {
        loading: 'Criando lista de destino...',
        success: () => {
          setIsDialogOpen(false);
          return 'Lista criada com sucesso!';
        },
        error: (err) => `Erro ao criar lista: ${err.message}`
      });
    }
  };

  const filteredDestinations = destinations?.filter(dest => 
    dest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dest.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <LayoutContainer type="operational">
      <PageHeader 
        title="Listas de Destino"
        description="Mapeamento tático de canais para envios de alta eficiência."
        icon={<Layers size={24} />}
        actions={
          <KineticButton onClick={handleCreate} className="gap-2 px-6 h-12">
            <Plus size={18} /> Nova Lista
          </KineticButton>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          label="Listas Ativas"
          value={stats.count}
          icon={<Layers size={12} />}
          colorScheme="kinetic"
        />
        <StatCard 
          label="Grupos Únicos"
          value={stats.uniqueGroups}
          icon={<Users size={12} />}
          colorScheme="success"
        />
        <StatCard 
          label="Alcance Total"
          value={stats.totalReach >= 1000 ? `${(stats.totalReach / 1000).toFixed(1)}k` : stats.totalReach}
          icon={<Target size={12} />}
          colorScheme="kinetic"
        />
      </div>

      {/* Info Banner */}
      <div className="bg-white/5 border border-white/5 rounded-3xl p-5 flex gap-4 items-start shadow-skeuo-pressed">
        <div className="p-2 bg-kinetic-orange/10 rounded-xl mt-1">
          <Info className="text-kinetic-orange" size={18} />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-bold text-white/80">Otimização de Envios</p>
          <p className="text-[11px] text-white/40 leading-relaxed font-medium">
            Listas de destino são coleções táticas de grupos. Use-as para disparar para 20+ canais com um único clique, mantendo a organização por categorias como "VIP", "Promos Gerais" ou "Eletrônicos".
          </p>
        </div>
      </div>

      {/* Search and Grid */}
      <div className="space-y-6">
      <div className="flex items-center gap-4 bg-anthracite-surface p-4 rounded-2xl border-none shadow-skeuo-flat mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={18} />
          <Input 
            placeholder="Buscar listas por nome..." 
            className="pl-10 bg-white/5 border-none shadow-skeuo-pressed"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => refetchDestinations()} 
          className="shrink-0 h-12 w-12 rounded-xl bg-white/5 border border-white/5"
        >
          <RefreshCw size={18} className={isLoadingDestinations ? "animate-spin text-kinetic-orange" : "text-white/40"} />
        </Button>
      </div>

        {isLoadingDestinations ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Skeleton className="h-[280px] w-full rounded-3xl bg-white/5" />
            <Skeleton className="h-[280px] w-full rounded-3xl bg-white/5" />
            <Skeleton className="h-[280px] w-full rounded-3xl bg-white/5" />
          </div>
        ) : isErrorDestinations ? (
          <div className="p-12 text-center bg-red-500/5 rounded-[40px] border border-red-500/10">
            <p className="text-red-500 font-black uppercase tracking-widest text-sm italic">Erro de Sincronização</p>
            <p className="text-white/20 text-xs mt-1">Não foi possível carregar as listas de destino.</p>
            <Button variant="link" onClick={() => refetchDestinations()} className="text-kinetic-orange mt-4 uppercase font-bold text-[10px] tracking-widest">Tentar novamente</Button>
          </div>
        ) : (
          <DestinationList 
            destinations={filteredDestinations || []} 
            onEdit={handleEdit} 
            onDelete={handleDelete} 
          />
        )}
      </div>

      <DestinationDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleSubmit}
        initialData={editingDest}
        isSubmitting={createDest.isPending || updateDest.isPending}
      />
    </LayoutContainer>
  );
}
