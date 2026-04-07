'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCampaigns, useDeleteCampaign } from '@/hooks/use-campaigns';
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
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { 
  MoreHorizontal, 
  Trash, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  LayoutList,
  RefreshCw,
  Search
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function CampanhasPage() {
  const { user } = useAuth();
  const { data: campaigns, isLoading, isError, refetch } = useCampaigns(user?.id);
  const deleteCampaign = useDeleteCampaign();

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta campanha?')) {
      deleteCampaign.mutate({ id, userId: user?.id as string });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20 capitalize gap-1"><CheckCircle2 size={12} /> Enviado</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20 capitalize gap-1"><Clock size={12} /> Agendado</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="capitalize">Falhou</Badge>;
      default:
        return <Badge variant="secondary" className="capitalize">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <LayoutList size={24} />
            <h1 className="text-3xl font-bold tracking-tight">Campanhas</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Histórico de envios e agendamentos de ofertas realizados pelo sistema.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input 
            placeholder="Buscar por nome da campanha..." 
            className="pl-10 bg-muted/50 border-none"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} className="shrink-0">
          <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
        </Button>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Campanha</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Agendado/Enviado em</TableHead>
              <TableHead>Produtos</TableHead>
              <TableHead className="w-[80px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-[80px] rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[40px]" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-md" /></TableCell>
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-red-500">
                  Erro ao carregar campanhas.
                </TableCell>
              </TableRow>
            ) : campaigns?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  Nenhuma campanha encontrada.
                </TableCell>
              </TableRow>
            ) : (
              campaigns?.map((campaign) => (
                <TableRow key={campaign.id} className="group hover:bg-muted/20 transition-colors">
                  <TableCell className="font-medium">
                    {campaign.name || 'Sem nome'}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(campaign.status)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} className="opacity-50" />
                      {campaign.scheduled_at 
                        ? format(new Date(campaign.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                        : campaign.created_at 
                          ? format(new Date(campaign.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                          : '--'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono bg-muted/30">
                      {campaign.items?.length || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => handleDelete(campaign.id)}
                          className="text-destructive focus:text-destructive focus:bg-destructive/10 gap-2 cursor-pointer"
                        >
                          <Trash size={14} /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
