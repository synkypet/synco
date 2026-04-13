'use client';

import React, { useState } from 'react';
import { Channel } from '@/types/group';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { TactileCard } from '@/components/ui/TactileCard';
import { MoreVertical, Edit, Trash2, Send, MessageCircle, QrCode, RefreshCw, AlertCircle, PhoneOff, Zap, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ChannelTelegramConnectDialog } from './ChannelTelegramConnectDialog';
import { ChannelWasenderConnectDialog } from './ChannelWasenderConnectDialog';
import { toast } from 'sonner';
import { KineticButton } from '@/components/ui/KineticButton';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useChannels, useCreateChannel, useUpdateChannel, useDeleteChannel, useDisconnectChannel, useRefreshChannelStatus } from '@/hooks/use-channels';

interface ChannelListProps {
  channels: Channel[];
  onEdit: (channel: Channel) => void;
  onDelete: (channel: Channel) => void;
}

export function ChannelList({ channels, onEdit, onDelete }: ChannelListProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [connectChannel, setConnectChannel] = useState<Channel | null>(null);
  const [connectTelegramChannel, setConnectTelegramChannel] = useState<Channel | null>(null);
  const [isSyncingId, setIsSyncingId] = useState<string | null>(null);

  const disconnectChannel = useDisconnectChannel();
  const refreshStatus = useRefreshChannelStatus();

  const handleSyncGroups = async (channelId: string, forceRestart = false) => {
    try {
       setIsSyncingId(channelId);
       
       if (forceRestart) {
         toast.info("Reinicializando sessão... Aguarde 5 segundos.");
       }

       const res = await fetch('/api/wasender/groups/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel_id: channelId, force_restart: forceRestart })
       });
       
       const data = await res.json();
       if (!res.ok) throw new Error(data.error || data.reason || 'Erro desconhecido');
       
       if (user?.id) {
         queryClient.invalidateQueries({ queryKey: ['channels', user.id] });
         queryClient.invalidateQueries({ queryKey: ['groups', user.id] });
       }
       
       toast.success(data.message);
    } catch (e: any) {
       toast.error(`Falha ao sincronizar: ${e.message}`);
    } finally {
       setIsSyncingId(null);
    }
  };

  const handleDisconnect = (channel: Channel) => {
    if (window.confirm(`Deseja realmente desconectar o WhatsApp do canal "${channel.name}"? As configurações locais serão mantidas.`)) {
      disconnectChannel.mutate({ id: channel.id, user_id: user?.id as string });
    }
  };

  const handleRefresh = (channel: Channel) => {
    refreshStatus.mutate({ id: channel.id, user_id: user?.id as string });
  };

  const renderStatus = (channel: Channel) => {
    const status = channel.config?.wasender_status || channel.config?.status;
    
    if (channel.type === 'whatsapp') {
      switch (status) {
        case 'connected': return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-none font-black text-[9px] uppercase tracking-widest"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 shrink-0 animate-pulse" /> Conectado</Badge>;
        case 'connecting': return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-none font-black text-[9px] uppercase tracking-widest animate-pulse"><RefreshCw size={10} className="mr-1.5 animate-spin" /> Conectando</Badge>;
        case 'qrcode_pending': 
        case 'need_scan': return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-none font-black text-[9px] uppercase tracking-widest"><QrCode size={10} className="mr-1.5 text-kinetic-orange" /> Escanear QR</Badge>;
        case 'disconnected': return <Badge variant="outline" className="bg-white/5 text-white/40 border-none font-black text-[9px] uppercase tracking-widest"><PhoneOff size={10} className="mr-1.5" /> Desconectado</Badge>;
        case 'logged_out': 
        case 'expired': return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-none font-black text-[9px] uppercase tracking-widest"><AlertCircle size={10} className="mr-1.5" /> Log-out / Expirado</Badge>;
        default: return <Badge variant="outline" className="bg-white/5 text-white/40 border-none font-black text-[9px] uppercase tracking-widest">Sem Instância</Badge>;
      }
    } else if (channel.type === 'telegram') {
      if (status === 'connected') {
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-none font-black text-[9px] uppercase tracking-widest"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2 shrink-0 animate-pulse" /> Conectado</Badge>;
      }
      return <Badge variant="outline" className="bg-white/5 text-white/40 border-none font-black text-[9px] uppercase tracking-widest">Sem Bot Token</Badge>;
    }
    return null;
  };

  if (channels.length === 0) {
    return (
      <div className="col-span-full py-24 text-center bg-white/5 rounded-[40px] border-2 border-dashed border-white/5 flex flex-col items-center gap-6 animate-in fade-in duration-700">
         <div className="p-6 bg-white/5 rounded-full shadow-skeuo-flat border border-white/5">
            <Zap size={48} className="text-white/10" />
         </div>
         <div className="space-y-1">
            <p className="text-white/80 font-black uppercase tracking-[0.2em] text-sm italic font-headline">Nenhum Canal Ativo</p>
            <p className="text-white/20 text-[10px] font-medium uppercase tracking-widest">Inicie a infraestrutura conectando seu WhatsApp ou Telegram.</p>
         </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {channels.map((channel) => {
          const isWhatsApp = channel.type === 'whatsapp';
          const wasStatus = channel.config?.wasender_status || channel.config?.status;
          const isConnected = wasStatus === 'connected';
          const isBusy = disconnectChannel.isPending || refreshStatus.isPending || isSyncingId === channel.id;

          return (
            <TactileCard key={channel.id} className="group overflow-hidden border-white/5 hover:border-kinetic-orange/20 transition-all duration-500 flex flex-col">
              <div className="p-8 pb-0">
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center shadow-skeuo-flat border border-white/10 ${isWhatsApp ? 'group-hover:border-emerald-500/20' : 'group-hover:border-blue-500/20'} transition-all`}>
                      {isWhatsApp ? (
                        <MessageCircle size={28} className={isConnected ? "text-emerald-500" : "text-white/20"} />
                      ) : (
                        <Send size={28} className="text-blue-500" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <h3 className="font-black text-white/90 uppercase tracking-tight italic text-xl font-headline leading-none">
                        {channel.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-2">
                         <Badge variant="outline" className="text-[9px] font-black uppercase border-white/10 text-white/30 h-4 tracking-widest leading-none">
                           {isWhatsApp ? 'Módulo WhatsApp' : 'Protocolo Telegram'}
                         </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-3">
                    {renderStatus(channel)}
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-white/5 border border-white/5 opacity-40 group-hover:opacity-100 transition-opacity">
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[230px] bg-anthracite-surface border-white/5 shadow-skeuo-elevated">
                        <DropdownMenuItem onClick={() => onEdit(channel)} className="gap-2 cursor-pointer text-[10px] font-bold uppercase tracking-widest text-white/60 focus:text-kinetic-orange">
                          <Edit size={14} /> CONFIGURAÇÕES GERAIS
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={() => handleRefresh(channel)} disabled={isBusy} className="gap-2 cursor-pointer text-[10px] font-bold uppercase tracking-widest text-white/60 focus:text-cyan-400">
                          <RefreshCw size={14} className={refreshStatus.isPending ? "animate-spin" : ""} /> FORÇAR CHECK DE STATUS
                        </DropdownMenuItem>
                        
                        {isWhatsApp && isConnected && (
                          <>
                            <DropdownMenuItem 
                              onClick={() => handleSyncGroups(channel.id, true)} 
                              disabled={isBusy}
                              className="gap-2 cursor-pointer text-[10px] font-bold uppercase tracking-widest text-white/60 focus:text-kinetic-orange"
                            >
                              <Zap size={14} /> REINICIAR MALHA (RESTART)
                            </DropdownMenuItem>

                            <DropdownMenuItem 
                              onClick={() => handleDisconnect(channel)} 
                              disabled={isBusy}
                              className="gap-2 cursor-pointer text-[10px] font-bold uppercase tracking-widest text-red-500/80 focus:text-red-400"
                            >
                              <PhoneOff size={14} /> DESCONECTAR WHATSAPP
                            </DropdownMenuItem>
                          </>
                        )}
                        
                        <DropdownMenuSeparator className="bg-white/5" />
                        
                        <DropdownMenuItem 
                          onClick={() => onDelete(channel)} 
                          className="text-red-600 focus:text-red-400 focus:bg-red-500/10 gap-2 cursor-pointer text-[10px] font-bold uppercase tracking-widest"
                        >
                          <Trash2 size={14} /> EXCLUIR INSTÂNCIA (REMOVER REMOTAMENTE)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="bg-white/5 rounded-3xl p-6 border border-white/[0.02] shadow-skeuo-pressed space-y-4">
                   <div className="flex items-start gap-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/10 mt-1.5 shrink-0" />
                      <p className="text-[11px] font-medium text-white/40 leading-relaxed italic uppercase tracking-tight">
                        {channel.description || 'Nenhuma diretriz operacional cadastrada para este canal.'}
                      </p>
                   </div>
                </div>
              </div>

              <div className="p-8 flex items-center justify-between mt-auto gap-4">
                 <div className="flex items-center gap-2">
                    {isWhatsApp ? (
                      <KineticButton 
                        onClick={() => handleSyncGroups(channel.id)} 
                        disabled={!isConnected || isSyncingId === channel.id}
                        className={`h-11 px-6 rounded-2xl font-headline text-[10px] font-black uppercase tracking-widest italic flex gap-3 ${!isConnected ? 'opacity-20 grayscale grayscale cursor-not-allowed grayscale' : ''}`}
                      >
                         <RefreshCw size={14} className={isSyncingId === channel.id ? "animate-spin" : ""} /> 
                         Sincronizar Malha
                      </KineticButton>
                    ) : (
                      <div className="flex items-center gap-2 text-white/10">
                        <ShieldCheck size={14} />
                        <span className="text-[9px] font-black uppercase tracking-widest">Canal Telegram Auditado</span>
                      </div>
                    )}
                 </div>

                 <Button 
                   variant="ghost" 
                   className="h-11 px-8 rounded-2xl bg-white/5 border border-white/10 text-white/40 hover:text-kinetic-orange hover:bg-kinetic-orange/10 hover:border-kinetic-orange/20 font-headline text-[10px] font-black uppercase tracking-widest italic transition-all gap-3"
                   onClick={() => isWhatsApp ? setConnectChannel(channel) : setConnectTelegramChannel(channel)}
                 >
                    <QrCode size={14} /> 
                    {isConnected ? 'RECONFIGURAR' : 'CONECTAR'}
                 </Button>
              </div>
            </TactileCard>
          );
        })}
      </div>
      
      <ChannelWasenderConnectDialog 
        isOpen={!!connectChannel} 
        onClose={() => setConnectChannel(null)} 
        channel={connectChannel}
        onConnected={() => {
           toast.success("Sessão conectada recarregando a página.");
           setTimeout(() => window.location.reload(), 1500);
        }}
      />

      <ChannelTelegramConnectDialog 
        isOpen={!!connectTelegramChannel}
        onClose={() => setConnectTelegramChannel(null)}
        channel={connectTelegramChannel}
        onConnected={() => {
           toast.success("Bot conectado! Recarregando...");
           setTimeout(() => window.location.reload(), 1500);
        }}
      />
    </>
  );
}
