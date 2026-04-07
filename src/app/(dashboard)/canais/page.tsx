'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useChannels, useCreateChannel, useUpdateChannel, useDeleteChannel } from '@/hooks/use-channels';
import { ChannelList } from '@/components/channels/ChannelList';
import { ChannelDialog } from '@/components/channels/ChannelDialog';
import { Channel } from '@/types/group';
import { Button } from '@/components/ui/button';
import { Plus, List, Search, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export default function CanaisPage() {
  const { user } = useAuth();
  const { data: channels, isLoading, isError, refetch } = useChannels(user?.id);
  const createChannel = useCreateChannel();
  const updateChannel = useUpdateChannel();
  const deleteChannel = useDeleteChannel();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleCreate = () => {
    setEditingChannel(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (channel: Channel) => {
    setEditingChannel(channel);
    setIsDialogOpen(true);
  };

  const handleDelete = (channel: Channel) => {
    if (window.confirm(`Tem certeza que deseja excluir o canal "${channel.name}"?`)) {
      deleteChannel.mutate({ id: channel.id, user_id: user?.id as string });
    }
  };

  const handleSubmit = (data: any) => {
    if (editingChannel) {
      updateChannel.mutate({
        id: editingChannel.id,
        user_id: user?.id as string,
        ...data,
      }, {
        onSuccess: () => setIsDialogOpen(false)
      });
    } else {
      createChannel.mutate({
        user_id: user?.id as string,
        ...data,
      }, {
        onSuccess: () => setIsDialogOpen(false)
      });
    }
  };

  const filteredChannels = channels?.filter(channel => 
    channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    channel.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <List size={24} />
            <h1 className="text-3xl font-bold tracking-tight">Canais</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Gerencie seus canais de transmissão. Os canais são usados para agrupar seus grupos e destinos de envio.
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2 shadow-lg shadow-primary/20">
          <Plus size={18} /> Novo Canal
        </Button>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="Buscar canais..." 
            className="pl-10 bg-muted/50 border-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} className="shrink-0">
          <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[60px] w-full rounded-xl" />
          <Skeleton className="h-[60px] w-full rounded-xl" />
          <Skeleton className="h-[60px] w-full rounded-xl" />
        </div>
      ) : isError ? (
        <div className="p-8 text-center bg-red-50 rounded-2xl border border-red-100">
          <p className="text-red-600 font-medium">Erro ao carregar canais do Supabase.</p>
          <Button variant="link" onClick={() => refetch()} className="text-red-500">Tentar novamente</Button>
        </div>
      ) : (
        <ChannelList 
          channels={filteredChannels || []} 
          onEdit={handleEdit} 
          onDelete={handleDelete} 
        />
      )}

      <ChannelDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleSubmit}
        initialData={editingChannel}
        isSubmitting={createChannel.isPending || updateChannel.isPending}
      />
    </div>
  );
}
