'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDestinations, useCreateDestination, useUpdateDestination, useDeleteDestination } from '@/hooks/use-destinations';
import { DestinationList } from '@/components/destinations/DestinationList';
import { DestinationDialog } from '@/components/destinations/DestinationDialog';
import { DestinationList as DestinationType } from '@/types/destination-list';
import { Button } from '@/components/ui/button';
import { Plus, Layers, Search, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

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
      deleteDest.mutate({ id: dest.id, user_id: user?.id as string });
    }
  };

  const handleSubmit = (data: any) => {
    const { groupIds, ...destinationData } = data;
    
    if (editingDest) {
      updateDest.mutate({
        id: editingDest.id,
        user_id: user?.id as string,
        destination: destinationData,
        groupIds: groupIds,
      }, {
        onSuccess: () => setIsDialogOpen(false)
      });
    } else {
      createDest.mutate({
        destination: {
          user_id: user?.id as string,
          ...destinationData,
          is_active: true
        },
        groupIds: groupIds,
      }, {
        onSuccess: () => setIsDialogOpen(false)
      });
    }
  };

  const filteredDestinations = destinations?.filter(dest => 
    dest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dest.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Layers size={24} />
            <h1 className="text-3xl font-bold tracking-tight">Listas de Destino</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Crie conjuntos de grupos para simplificar o envio de ofertas. Você pode selecionar múltiplos grupos de diferentes canais em uma única lista.
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2 shadow-lg shadow-primary/20">
          <Plus size={18} /> Nova Lista
        </Button>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="Buscar por nome ou descrição..." 
            className="pl-10 bg-muted/50 border-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => refetchDestinations()} className="shrink-0">
          <RefreshCw size={18} className={isLoadingDestinations ? "animate-spin" : ""} />
        </Button>
      </div>

      {isLoadingDestinations ? (
        <div className="space-y-4">
          <Skeleton className="h-[60px] w-full rounded-xl" />
          <Skeleton className="h-[60px] w-full rounded-xl" />
          <Skeleton className="h-[60px] w-full rounded-xl" />
        </div>
      ) : isErrorDestinations ? (
        <div className="p-8 text-center bg-red-50 rounded-2xl border border-red-100">
          <p className="text-red-600 font-medium">Erro ao carregar listas do Supabase.</p>
          <Button variant="link" onClick={() => refetchDestinations()} className="text-red-500">Tentar novamente</Button>
        </div>
      ) : (
        <DestinationList 
          destinations={filteredDestinations || []} 
          onEdit={handleEdit} 
          onDelete={handleDelete} 
        />
      )}

      <DestinationDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleSubmit}
        initialData={editingDest}
        isSubmitting={createDest.isPending || updateDest.isPending}
      />
    </div>
  );
}
