'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGroups, useCreateGroup, useUpdateGroup, useDeleteGroup } from '@/hooks/use-groups';
import { useChannels } from '@/hooks/use-channels';
import { GroupList } from '@/components/groups/GroupList';
import { GroupDialog } from '@/components/groups/GroupDialog';
import { Group } from '@/types/group';
import { Button } from '@/components/ui/button';
import { Plus, Users, Search, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export default function GruposPage() {
  const { user } = useAuth();
  const { data: groups, isLoading: isLoadingGroups, isError: isErrorGroups, refetch: refetchGroups } = useGroups(user?.id);
  const { data: channels, isLoading: isLoadingChannels } = useChannels(user?.id);
  
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const deleteGroup = useDeleteGroup();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleCreate = () => {
    setEditingGroup(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (group: Group) => {
    setEditingGroup(group);
    setIsDialogOpen(true);
  };

  const handleDelete = (group: Group) => {
    if (window.confirm(`Tem certeza que deseja excluir o grupo "${group.name}"?`)) {
      deleteGroup.mutate({ id: group.id, user_id: user?.id as string });
    }
  };

  const handleSubmit = (data: any) => {
    if (editingGroup) {
      updateGroup.mutate({
        id: editingGroup.id,
        user_id: user?.id as string,
        ...data,
      }, {
        onSuccess: () => setIsDialogOpen(false)
      });
    } else {
      createGroup.mutate({
        user_id: user?.id as string,
        ...data,
      }, {
        onSuccess: () => setIsDialogOpen(false)
      });
    }
  };

  const filteredGroups = groups?.filter(group => 
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isLoading = isLoadingGroups || isLoadingChannels;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Users size={24} />
            <h1 className="text-3xl font-bold tracking-tight">Grupos</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Gerencie os grupos de destino das suas ofertas. Cada grupo deve estar vinculado a um canal (WhatsApp ou Telegram).
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2 shadow-lg shadow-primary/20">
          <Plus size={18} /> Novo Grupo
        </Button>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="Buscar por nome, ID ou descrição..." 
            className="pl-10 bg-muted/50 border-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => refetchGroups()} className="shrink-0">
          <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[60px] w-full rounded-xl" />
          <Skeleton className="h-[60px] w-full rounded-xl" />
          <Skeleton className="h-[60px] w-full rounded-xl" />
        </div>
      ) : isErrorGroups ? (
        <div className="p-8 text-center bg-red-50 rounded-2xl border border-red-100">
          <p className="text-red-600 font-medium">Erro ao carregar grupos do Supabase.</p>
          <Button variant="link" onClick={() => refetchGroups()} className="text-red-500">Tentar novamente</Button>
        </div>
      ) : (
        <GroupList 
          groups={filteredGroups || []} 
          channels={channels || []}
          onEdit={handleEdit} 
          onDelete={handleDelete} 
        />
      )}

      <GroupDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleSubmit}
        initialData={editingGroup}
        isSubmitting={createGroup.isPending || updateGroup.isPending}
      />
    </div>
  );
}
