'use client';

import React, { useState } from 'react';
import { 
  Activity, 
  Bell, 
  Clock, 
  Zap, 
  Search, 
  Filter, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  TrendingUp,
  Package,
  Layers,
  Users,
  Settings2,
  Play,
  Pause,
  ExternalLink
} from 'lucide-react';
import LayoutContainer from '@/components/layout/LayoutContainer';
import PageHeader from '@/components/shared/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { TactileCard } from '@/components/ui/TactileCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { 
  useAutomationSources, 
  useAllAutomationLogs, 
  useAutomationSummary,
  useUpdateAutomationSource 
} from '@/hooks/use-automations';
import { useCampaigns, useQueuePosition } from '@/hooks/use-campaigns';
import Link from 'next/link';

// ─── Component: Live Queue Item ─────────────────────────────────────────────

function LiveQueueItem({ campaign }: { campaign: any }) {
  const { data: queue } = useQueuePosition(campaign.id);
  const totalItems = campaign.destinations?.length || 0;
  const completed = campaign.destinations?.filter((d: any) => d.status === 'sent' || d.status === 'failed').length || 0;
  const progress = totalItems > 0 ? Math.round((completed / totalItems) * 100) : 0;

  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-black/20 border border-white/5 hover:border-white/10 transition-colors group">
      <div className="w-10 h-10 rounded-xl bg-kinetic-orange/10 flex items-center justify-center shrink-0">
        <Zap className={cn("w-5 h-5 text-kinetic-orange", queue?.operationalStatus === 'sending' && "animate-pulse")} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-white/90 truncate">{campaign.name}</h4>
          <Badge variant="outline" className="h-4 text-[8px] font-black tracking-tighter bg-white/5 border-none text-white/40">
            {queue?.operationalStatus || 'QUEUED'}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-kinetic-orange transition-all duration-1000" 
              style={{ width: `${progress}%` }} 
            />
          </div>
          <span className="text-[9px] font-black font-mono text-white/20 whitespace-nowrap">{progress}%</span>
        </div>
      </div>
      <div className="text-right shrink-0 px-2 border-l border-white/5">
        <span className="block text-[10px] font-black text-white/60">Pos. {queue?.position || '--'}</span>
        <span className="text-[8px] font-bold text-white/20 uppercase">Fila Canal</span>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MonitoramentoPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [searchTerm, setSearchTerm] = useState('');

  // Data Hooks
  const { data: sources, isLoading: isLoadingSources } = useAutomationSources(user?.id as string);
  const { data: logs, isLoading: isLoadingLogs } = useAllAutomationLogs(user?.id as string, 30);
  const { data: summary, isLoading: isLoadingSummary } = useAutomationSummary(user?.id as string);
  const { data: campaignsData } = useCampaigns(user?.id, 1, 50); // Monitoramento busca as 50 mais recentes
  const updateSource = useUpdateAutomationSource();

  const activeCampaigns = campaignsData?.campaigns?.filter(c => c.status === 'sending' || c.status === 'pending') || [];

  const filteredSources = sources?.filter(s => {
    if (activeTab === 'groups') return s.source_type === 'group_monitor';
    if (activeTab === 'radar') return s.source_type === 'radar_offers';
    return true;
  }).filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())) || [];

  const isLoading = isLoadingSources || isLoadingSummary;

  if (isLoading) {
    return (
      <LayoutContainer type="analytical">
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4 opacity-20">
          <Loader2 className="w-10 h-10 animate-spin text-kinetic-orange" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] font-headline italic">Sincronizando Monitoramento...</span>
        </div>
      </LayoutContainer>
    );
  }

  // KPIs
  const KPI_GRID = [
    {
      label: 'Eventos Capturados',
      value: (summary?.captured || 0).toLocaleString(),
      description: 'Total de leads/links ingeridos',
      icon: <Layers size={16} />,
      colorScheme: 'default' as const,
    },
    {
      label: 'Mensagens Distribuídas',
      value: (summary?.processed || 0).toLocaleString(),
      description: 'Saídas via automação',
      icon: <CheckCircle2 size={16} />,
      colorScheme: 'success' as const,
    },
    {
      label: 'Falhas/Filtrados',
      value: (summary?.error || 0).toLocaleString(),
      description: 'Itens bloqueados ou erro',
      icon: <AlertCircle size={16} />,
      colorScheme: 'destructive' as const,
    },
    {
      label: 'Taxa de Conversão',
      value: summary?.captured ? `${Math.round((summary.processed / summary.captured) * 100)}%` : '0%',
      description: 'Conversão Ingestão -> Envio',
      icon: <TrendingUp size={16} />,
      colorScheme: 'kinetic' as const,
    },
  ];

  return (
    <LayoutContainer type="analytical">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <PageHeader 
          title="Monitoramento Real-time" 
          description="Acompanhe o fluxo de ingestão, processamento e distribuição de ofertas em tempo real."
          icon={<Activity size={24} />}
        />
        <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-3 py-1 gap-1.5 bg-kinetic-orange/5 border-kinetic-orange/20 text-kinetic-orange animate-pulse">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-kinetic-orange opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-kinetic-orange"></span>
                </span>
                LIVE ENGINE
            </Badge>
        </div>
      </div>

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {KPI_GRID.map((item) => (
          <StatCard 
            key={item.label}
            {...item}
          />
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList className="bg-muted/50 p-1 rounded-xl h-10 border border-white/5">
            <TabsTrigger value="general" className="text-[10px] font-black uppercase px-6">Geral</TabsTrigger>
            <TabsTrigger value="groups" className="text-[10px] font-black uppercase px-6">Grupos</TabsTrigger>
            <TabsTrigger value="radar" className="text-[10px] font-black uppercase px-6">Radar</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 w-3.5 h-3.5" />
              <Input 
                placeholder="Filtrar automações..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 text-[10px] font-black uppercase tracking-widest pl-10 bg-black/20 border-white/5 w-64 rounded-xl"
              />
            </div>
            <Button variant="outline" size="icon" className="h-10 w-10 border-white/5 bg-black/20 text-white/40">
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* List of Sources (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSources.map((source) => (
                <TactileCard key={source.id} className="p-6 border-none ring-1 ring-white/5 bg-anthracite-surface/40 hover:bg-anthracite-surface/60 transition-all group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center border",
                        source.source_type === 'radar_offers' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                      )}>
                        {source.source_type === 'radar_offers' ? <Zap size={20} /> : <Users size={20} />}
                      </div>
                      <div>
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-white/90 truncate max-w-[150px]">{source.name}</h4>
                        <p className="text-[9px] text-white/20 uppercase font-bold tracking-tighter">
                          {source.source_type === 'radar_offers' ? 'Monitor: Radar OfertAS' : 'Monitor: Grupos Ativos'}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => updateSource.mutate({ id: source.id, updates: { is_active: !source.is_active } })}
                      className={cn(
                        "h-8 w-8 rounded-full border border-white/5 shadow-skeuo-pressed",
                        source.is_active ? "text-emerald-500 bg-emerald-500/5" : "text-white/10 bg-black/40"
                      )}
                    >
                      {source.is_active ? <Play size={10} className="fill-current" /> : <Pause size={10} />}
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <div className="flex items-center gap-6">
                      <div className="text-left">
                        <span className="block text-[10px] font-black text-white/60">{(source as any).automation_routes?.length || 0}</span>
                        <span className="text-[8px] font-bold text-white/10 uppercase">Destinos</span>
                      </div>
                      <div className="text-left">
                        <span className="block text-[10px] font-black text-emerald-500/60 font-mono tracking-tighter italic">ONLINE</span>
                        <span className="text-[8px] font-bold text-white/10 uppercase">Status</span>
                      </div>
                    </div>
                    <Link href={`/automacoes`}>
                       <Button variant="ghost" size="sm" className="h-7 text-[8px] font-black uppercase bg-white/5 border-none opacity-0 group-hover:opacity-100 transition-all">Configurar</Button>
                    </Link>
                  </div>
                </TactileCard>
              ))}
              {filteredSources.length === 0 && (
                <div className="md:col-span-2 p-12 text-center rounded-3xl border border-dashed border-white/10 opacity-30">
                   <Package size={40} className="mx-auto mb-4" />
                   <p className="text-sm font-black uppercase tracking-widest italic">Nenhuma automação ativa neste filtro</p>
                </div>
              )}
            </div>

            {/* Event Flow List */}
            <TactileCard className="p-0 border-none bg-anthracite-surface/40 overflow-hidden">
               <div className="p-8 pb-4 flex items-center justify-between border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-white/40" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-white/90">Fluxo de Ingestão</h3>
                      <p className="text-[9px] text-white/20 uppercase tracking-widest">Logs factuais do processador</p>
                    </div>
                  </div>
               </div>

               <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
                 {logs?.map((log, i) => (
                   <div key={log.id} className="flex items-start gap-4 px-8 py-4 hover:bg-white/5 transition-colors group">
                      <div className="w-20 shrink-0 text-[10px] font-bold text-white/10 uppercase mt-1 group-hover:text-white/30 truncate">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={cn(
                            "text-[8px] font-black uppercase tracking-[0.2em] px-1.5 py-0.5 rounded border leading-none",
                            log.status === 'captured' && "bg-blue-500/10 text-blue-400 border-blue-500/20",
                            log.status === 'processed' && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                            log.status === 'error' && "bg-red-500/10 text-red-400 border-red-500/20",
                            log.status === 'filtered' && "bg-white/5 text-white/40 border-white/10"
                          )}>
                            {log.event_type}
                          </span>
                          <span className="text-[10px] font-bold text-white/20 italic truncate">{(log as any).source?.name || 'Sistema'}</span>
                        </div>
                        <p className="text-[11px] font-bold text-white/60 tracking-tight leading-normal">
                          {log.details?.message || log.details?.title || 'Evento capturado com sucesso'}
                        </p>
                      </div>
                      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                         <ExternalLink size={12} className="text-white/20" />
                      </div>
                   </div>
                 ))}
                 {(!logs || logs.length === 0) && !isLoadingLogs && (
                   <div className="p-16 text-center">
                     <Activity size={32} className="mx-auto mb-4 text-white/5" />
                     <p className="text-[10px] font-black uppercase tracking-widest text-white/10">Aguardando sinais do engine...</p>
                   </div>
                 )}
               </div>
            </TactileCard>
          </div>

          {/* Execution & Queue (1/3) */}
          <div className="space-y-8">
             <div className="flex items-center gap-3 mb-2">
                <Settings2 className="w-4 h-4 text-kinetic-orange/40" />
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 italic">Linha de Despacho</h3>
             </div>

             {/* Live Queue Items */}
             <div className="space-y-4">
                {activeCampaigns.map(campaign => (
                  <LiveQueueItem key={campaign.id} campaign={campaign} />
                ))}
                {activeCampaigns.length === 0 && (
                  <div className="p-12 text-center rounded-3xl border border-dashed border-white/5 opacity-10">
                     <Clock className="w-8 h-8 mx-auto mb-3" />
                     <p className="text-[9px] font-black uppercase">Fila de saída livre</p>
                  </div>
                )}
             </div>

             {/* Footer Stats / Operational Context */}
             <TactileCard className="p-8 border-none bg-gradient-to-br from-blue-500/5 to-transparent">
                <div className="flex items-center gap-3 mb-6">
                  <Activity size={16} className="text-blue-400" />
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-400/60 italic">Integridade Wasender</h3>
                </div>
                <div className="space-y-4">
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Sessões Ativas</span>
                      <span className="text-xs font-black text-white">01 / 01</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Latência API</span>
                      <span className="text-[10px] font-mono font-black text-emerald-500">24ms</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Heartbeat</span>
                      <span className="text-[9px] font-black text-white/60">OK</span>
                   </div>
                </div>
                <div className="h-px bg-white/5 my-6" />
                <p className="text-[9px] text-white/20 uppercase font-black leading-relaxed">
                  Sistema operando dentro dos parâmetros de pacing e cooldown padrão (M1).
                </p>
             </TactileCard>
          </div>
        </div>
      </Tabs>
    </LayoutContainer>
  );
}
