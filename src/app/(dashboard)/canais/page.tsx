'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useChannels, useCreateChannel, useUpdateChannel, useDeleteChannel } from '@/hooks/use-channels';
import { ChannelList } from '@/components/channels/ChannelList';
import { ChannelDialog } from '@/components/channels/ChannelDialog';
import { Channel } from '@/types/group';
import { Button } from '@/components/ui/button';
import { KineticButton } from '@/components/ui/KineticButton';
import { Plus, List, Search, RefreshCw, Radio } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import LayoutContainer from '@/components/layout/LayoutContainer';
import PageHeader from '@/components/shared/PageHeader';

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
    <LayoutContainer type="operational">
      <PageHeader 
        title="Canais" 
        description="Gerencie seus canais de transmissão. Os canais agrupam seus grupos e destinos de envio."
        icon={<Radio size={24} />}
        actions={
          <KineticButton onClick={handleCreate} className="gap-2 px-6 h-12">
            <Plus size={18} /> Novo Canal
          </KineticButton>
        }
      />

      <div className="flex items-center gap-4 bg-anthracite-surface p-4 rounded-2xl border-none shadow-skeuo-flat mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={18} />
          <Input 
            placeholder="Buscar canais..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <KineticButton onClick={() => refetch()} className="shrink-0 h-12 w-12 rounded-xl bg-white/5 border-none shadow-skeuo-flat">
          <RefreshCw size={18} className={isLoading ? "animate-spin text-kinetic-orange" : "text-white/40"} />
        </KineticButton>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[80px] w-full rounded-2xl bg-white/5" />
          <Skeleton className="h-[80px] w-full rounded-2xl bg-white/5" />
          <Skeleton className="h-[80px] w-full rounded-2xl bg-white/5" />
        </div>
      ) : isError ? (
        <div className="p-12 text-center bg-red-500/5 rounded-[40px] shadow-skeuo-pressed">
          <p className="text-red-500 font-black uppercase tracking-widest text-sm italic">Erro crítico de carregamento</p>
          <p className="text-white/20 text-xs mt-1">Não foi possível sincronizar os canais com o Supabase.</p>
          <KineticButton onClick={() => refetch()} className="text-kinetic-orange mt-4 uppercase font-bold text-[10px] tracking-widest bg-transparent shadow-none">Tentar novamente</KineticButton>
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
    </LayoutContainer>
  );
}
