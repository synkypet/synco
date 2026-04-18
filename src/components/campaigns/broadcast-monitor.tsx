// src/components/campaigns/broadcast-monitor.tsx
'use client';

import React, { useMemo } from 'react';
import { TactileCard } from '@/components/ui/TactileCard';
import { KineticButton } from '@/components/ui/KineticButton';
import { 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Clock, 
  SendHorizonal, 
  ChevronRight,
  RefreshCw,
  LayoutList
} from 'lucide-react';
import { useCampaignStats, useCampaignJobs, useCampaignDestinationStats } from '@/hooks/use-campaigns';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface BroadcastMonitorProps {
  campaignId: string;
  onNewCampaign: () => void;
  productsCount: number;
  groupsCount: number;
}

export function BroadcastMonitor({ campaignId, onNewCampaign, productsCount, groupsCount }: BroadcastMonitorProps) {
  const { data: stats, isLoading: loadingStats } = useCampaignStats(campaignId);
  
  const isFinished = stats && stats.total > 0 && stats.pending === 0 && stats.processing === 0;
  
  const { data: destStats, isLoading: loadingDestStats } = useCampaignDestinationStats(campaignId, !isFinished);
  const { data: jobsResponse, isLoading: loadingJobs } = useCampaignJobs(campaignId, 1);
  
  const jobs = jobsResponse?.jobs || [];
  
  const progress = useMemo(() => {
    if (!stats || stats.total === 0) return 0;
    const completed = (stats.completed || 0) + (stats.failed || 0);
    return Math.round((completed / stats.total) * 100);
  }, [stats]);

  const isEmpty = stats && stats.total === 0;
  const hasFailures = stats && stats.failed > 0;

  // Mapeamento amigável de status por destino
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Na fila';
      case 'processing': return 'Em andamento';
      case 'completed': return 'Concluído';
      case 'failed': return 'Falha';
      default: return 'Desconhecido';
    }
  };

  if (loadingStats && !stats) {
    return (
      <TactileCard className="p-8 flex flex-col items-center justify-center min-h-[400px] border-none">
        <Loader2 className="w-8 h-8 text-kinetic-orange animate-spin mb-4" />
        <p className="text-xs font-black uppercase tracking-widest opacity-40">Sincronizando monitor...</p>
      </TactileCard>
    );
  }

  return (
    <TactileCard className="p-8 border-none ring-1 ring-kinetic-orange/20 bg-gradient-to-br from-anthracite-surface to-deep-void shadow-skeuo-elevated">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-kinetic-orange mb-1 font-headline">
            Transmissão Ativa
          </h3>
          <p className="text-[10px] font-bold text-white/20 uppercase tracking-tighter">
            ID: {campaignId.slice(0, 8)}...
          </p>
        </div>
        {!isFinished && (
          <div className="flex items-center gap-2 px-3 py-1 bg-kinetic-orange/10 rounded-full">
            <RefreshCw className="w-3 h-3 text-kinetic-orange animate-spin" />
            <span className="text-[9px] font-black text-kinetic-orange uppercase">Ao Vivo</span>
          </div>
        )}
      </div>

      {/* Mini Resumo de Contexto */}
      <div className="grid grid-cols-3 gap-4 mb-8 p-4 bg-deep-void/40 rounded-2xl border-none shadow-skeuo-pressed">
        <div className="flex flex-col">
          <span className="text-[8px] font-bold text-white/20 uppercase">Produtos</span>
          <span className="text-sm font-black text-white/90">{productsCount}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[8px] font-bold text-white/20 uppercase">Destinos</span>
          <span className="text-sm font-black text-white/90">{groupsCount}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[8px] font-bold text-white/20 uppercase">Total Esperado</span>
          <span className="text-sm font-black text-kinetic-orange">{stats?.total || productsCount * groupsCount}</span>
        </div>
      </div>

      {/* Progress Bar Area Geral */}
      <div className="space-y-4 mb-10">
        <div className="flex justify-between items-end">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Progresso Geral</span>
          <span className="text-xl font-black text-kinetic-orange font-headline">{progress}%</span>
        </div>
        <div className="relative h-3 w-full bg-deep-void rounded-full p-0.5 overflow-hidden shadow-skeuo-pressed">
           <div 
             className="h-full bg-gradient-to-r from-kinetic-orange/60 to-kinetic-orange rounded-full transition-all duration-1000 shadow-glow-orange"
             style={{ width: `${progress}%` }}
           />
        </div>
        
        {/* Status Pills */}
        <div className="grid grid-cols-3 gap-2">
           <div className="p-3 bg-white/5 rounded-xl border-none flex flex-col items-center">
             <span className="text-[8px] font-black text-white/30 uppercase mb-1">Enviados</span>
             <span className="text-xs font-black text-green-400">{stats?.completed || 0}</span>
           </div>
           <div className="p-3 bg-white/5 rounded-xl border-none flex flex-col items-center">
             <span className="text-[8px] font-black text-white/30 uppercase mb-1">Falhas</span>
             <span className="text-xs font-black text-red-500">{stats?.failed || 0}</span>
           </div>
           <div className="p-3 bg-white/5 rounded-xl border-none flex flex-col items-center">
             <span className="text-[8px] font-black text-white/30 uppercase mb-1">Pendente</span>
             <span className="text-xs font-black text-white/60">{stats?.pending || 0}</span>
           </div>
        </div>
      </div>

      {/* Evolved Queue Area: Per Destination Progress */}
      <div className="space-y-4 mb-8">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
            <LayoutList className="w-3 h-3" /> Fila por Destino
          </span>
          <span className="text-[9px] font-bold text-white/20 uppercase">Tempo Real</span>
        </div>
        
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {loadingDestStats && !destStats ? (
            <div className="py-12 flex flex-col items-center justify-center opacity-40">
              <Loader2 className="w-5 h-5 animate-spin mb-2" />
              <span className="text-[9px] font-black uppercase tracking-widest">Calculando filas...</span>
            </div>
          ) : destStats?.map((dest: any) => (
            <div 
              key={dest.id} 
              className={cn(
                "p-4 bg-deep-void/60 rounded-2xl border-none shadow-skeuo-pressed group hover:bg-deep-void/80 transition-all",
                dest.status === 'completed' && "opacity-60 grayscale-[0.5]"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-skeuo-flat border-none",
                    dest.status === 'processing' ? "bg-kinetic-orange/20" : 
                    dest.status === 'completed' ? "bg-green-500/10" : "bg-black/20"
                  )}>
                    {dest.status === 'pending' && <Clock className="w-4 h-4 text-white/20" />}
                    {dest.status === 'processing' && <Loader2 className="w-4 h-4 text-kinetic-orange animate-spin" />}
                    {dest.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    {dest.status === 'failed' && <AlertCircle className="w-4 h-4 text-red-500" />}
                  </div>
                  
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-black text-white/90 uppercase truncate leading-none mb-1">
                      {dest.name}
                    </span>
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-widest",
                      dest.status === 'processing' ? "text-kinetic-orange" : 
                      dest.status === 'completed' ? "text-green-500/80" : "text-white/20"
                    )}>
                      {getStatusLabel(dest.status)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                   <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-white/40 uppercase">
                        {dest.completed}/{dest.total} Sent
                      </span>
                      <span className="text-xs font-black text-kinetic-orange font-headline italic">
                        {dest.progress}%
                      </span>
                   </div>
                </div>
              </div>

              {/* Sub-Progress Bar per Destino */}
              <div className="relative h-1.5 w-full bg-black/40 rounded-full overflow-hidden shadow-skeuo-pressed">
                  <div 
                    className={cn(
                      "h-full transition-all duration-1000 rounded-full",
                      dest.status === 'completed' ? "bg-green-500/40" : 
                      dest.status === 'failed' ? "bg-red-500/60" : "bg-kinetic-orange shadow-glow-orange"
                    )}
                    style={{ width: `${dest.progress}%` }}
                  />
              </div>
            </div>
          ))}
          
          {destStats?.length === 0 && !loadingDestStats && (
            <div className="py-12 text-center opacity-20">
              <span className="text-[10px] font-black uppercase tracking-widest">Nenhuma fila identificada</span>
            </div>
          )}
        </div>
      </div>
      {/* Final State & Action Zone */}
      <div className="space-y-4 pt-4 border-t border-white/5">
        {isEmpty && !loadingStats && (
          <div className="p-4 rounded-2xl flex items-center gap-4 bg-amber-500/10 border border-amber-500/20 animate-in fade-in">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/20">
              <AlertCircle className="w-5 h-5 text-amber-500" /> 
            </div>
            <div>
              <p className="text-xs font-black uppercase text-amber-500">
                Nenhum Envio Gerado
              </p>
              <p className="text-[9px] font-bold text-white/40 uppercase mt-0.5">
                Verifique se os canais estão conectados ou se os itens foram bloqueados.
              </p>
            </div>
          </div>
        )}

        {isFinished && (
          <div className={cn(
            "p-4 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2",
            hasFailures ? "bg-amber-500/10 border border-amber-500/20" : "bg-green-500/10 border border-green-500/20"
          )}>
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
              hasFailures ? "bg-amber-500/20" : "bg-green-500/20"
            )}>
              {hasFailures ? <AlertCircle className="w-5 h-5 text-amber-500" /> : <CheckCircle2 className="w-5 h-5 text-green-500" />}
            </div>
            <div>
              <p className={cn("text-xs font-black uppercase", hasFailures ? "text-amber-500" : "text-green-500")}>
                {hasFailures ? "Transmissão Concluída com Alertas" : "Transmissão Finalizada!"}
              </p>
              <p className="text-[9px] font-bold text-white/40 uppercase mt-0.5">
                {hasFailures ? `${stats.failed} itens falharam. Verifique o log.` : "Todos os envios foram entregues à Wasender."}
              </p>
            </div>
          </div>
        )}

        <KineticButton
          className="w-full h-12 font-black uppercase tracking-widest text-xs"
          onClick={onNewCampaign}
        >
          {isFinished ? (
             <>Nova Campanha <ChevronRight className="w-4 h-4 ml-2" /></>
          ) : (
            <>Voltar ao Formulário</>
          )}
        </KineticButton>
      </div>
    </TactileCard>
  );
}
