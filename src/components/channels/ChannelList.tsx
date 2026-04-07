'use client';

import React, { useState } from 'react';
import { Channel } from '@/types/group';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit, Trash2, Send, MessageCircle, QrCode, RefreshCw, AlertCircle, PhoneOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ChannelWasenderConnectDialog } from './ChannelWasenderConnectDialog';
import { toast } from 'sonner';

interface ChannelListProps {
  channels: Channel[];
  onEdit: (channel: Channel) => void;
  onDelete: (channel: Channel) => void;
}

export function ChannelList({ channels, onEdit, onDelete }: ChannelListProps) {
  const [connectChannel, setConnectChannel] = useState<Channel | null>(null);
  const [isSyncingId, setIsSyncingId] = useState<string | null>(null);

  const handleSyncGroups = async (channelId: string) => {
    try {
       setIsSyncingId(channelId);
       const res = await fetch('/api/wasender/groups/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel_id: channelId })
       });
       const data = await res.json();
       if (!res.ok) throw new Error(data.error);
       
       toast.success(`Sincronização concluída! ${data.synced} grupos retornados.`);
    } catch (e: any) {
       toast.error(`Falha ao sincronizar grupos: ${e.message}`);
    } finally {
       setIsSyncingId(null);
    }
  };

  const renderStatus = (channel: Channel) => {
    if (channel.type !== 'whatsapp') return null;
    const status = channel.config?.status;
    
    switch (status) {
      case 'connected': return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-none font-black text-[9px] uppercase tracking-widest"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 shrink-0 animate-pulse" /> Conectado</Badge>;
      case 'qrcode_pending': return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-none font-black text-[9px] uppercase tracking-widest"><QrCode size={10} className="mr-1.5" /> Aguardando QR</Badge>;
      case 'disconnected': return <Badge variant="outline" className="bg-muted text-muted-foreground border-none font-black text-[9px] uppercase tracking-widest"><PhoneOff size={10} className="mr-1.5" /> Desconectado</Badge>;
      case 'session_lost': return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-none font-black text-[9px] uppercase tracking-widest"><AlertCircle size={10} className="mr-1.5" /> Sessão Perdida</Badge>;
      case 'sync_failed': return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-none font-black text-[9px] uppercase tracking-widest"><AlertCircle size={10} className="mr-1.5" /> Falha no Link</Badge>;
      default: return <Badge variant="outline" className="bg-white/5 text-white/40 border-none font-black text-[9px] uppercase tracking-widest">Sem Instância</Badge>;
    }
  };

  if (channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/20 rounded-2xl border-2 border-dashed">
        <div className="p-4 bg-muted/50 rounded-full mb-4">
           <Send className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-bold">Nenhum canal encontrado</h3>
        <p className="text-muted-foreground max-w-sm mx-auto mt-2">
          Você ainda não cadastrou nenhum canal de envio. Crie seu primeiro canal para começar a organizar seus grupos.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Nome e Tipo</TableHead>
              <TableHead>Status Instância</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-[100px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {channels.map((channel) => (
              <TableRow key={channel.id} className="hover:bg-muted/30 transition-colors">
                <TableCell>
                  <p className="font-semibold">{channel.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {channel.type === 'whatsapp' ? (
                      <span className="flex items-center text-xs text-green-600 font-medium">
                        <MessageCircle size={12} className="mr-1" /> WhatsApp
                      </span>
                    ) : (
                      <span className="flex items-center text-xs text-blue-600 font-medium">
                        <Send size={12} className="mr-1" /> Telegram
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {renderStatus(channel)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm max-w-[300px] truncate">
                  {channel.description || <span className="text-muted-foreground/50 italic">Sem descrição</span>}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                        <MoreHorizontal size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[200px]">
                      
                      {channel.type === 'whatsapp' && (
                         <>
                            <DropdownMenuItem onClick={() => setConnectChannel(channel)} className="gap-2 cursor-pointer text-kinetic-orange focus:text-kinetic-orange focus:bg-kinetic-orange/10 font-bold text-xs uppercase tracking-widest">
                               <QrCode size={14} /> {channel.config?.status === 'connected' ? 'Reconectar' : 'Conectar WP'}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                               onClick={() => handleSyncGroups(channel.id)} 
                               disabled={channel.config?.status !== 'connected' || isSyncingId === channel.id}
                               className="gap-2 cursor-pointer text-xs font-bold uppercase tracking-tight"
                            >
                               <RefreshCw size={14} className={isSyncingId === channel.id ? "animate-spin" : ""} /> Sync Grupos
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                         </>
                      )}

                      <DropdownMenuItem onClick={() => onEdit(channel)} className="gap-2 cursor-pointer">
                        <Edit size={14} className="text-primary" /> Editar Canal
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => onDelete(channel)} 
                        className="text-destructive focus:text-destructive focus:bg-destructive/10 gap-2 cursor-pointer"
                      >
                        <Trash2 size={14} /> Excluir Canal
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
    </>
  );
}
