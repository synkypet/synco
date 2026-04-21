'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  Users,
  Radar,
  Layers,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Zap,
  Eye,
  AlertTriangle,
  Circle,
} from 'lucide-react';
import LayoutContainer from '@/components/layout/LayoutContainer';
import PageHeader from '@/components/shared/PageHeader';
import { TactileCard } from '@/components/ui/TactileCard';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface AutomationSource {
  id: string;
  name: string;
  is_active: boolean;
  source_type: string;
  created_at: string;
  automation_routes: { id: string; target_type: string; target_id: string; is_active: boolean }[];
}

interface SendJob {
  id: string;
  campaign_id: string;
  status: string;
  created_at: string;
  destination: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  created_at: string;
  total_destinations: number;
}

interface AutomationLog {
  id: string;
  source_id: string;
  status: string;
  event_type: string;
  details: any;
  created_at: string;
}

interface MonitoringData {
  groupSources: AutomationSource[];
  radarSources: AutomationSource[];
  pendingJobs: SendJob[];
  activeCampaigns: Campaign[];
  recentLogs: AutomationLog[];
  queuePositions: Record<string, number>;
  totalPending: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `há ${minutes}min`;
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className={cn(
      'w-2 h-2 rounded-full inline-block shrink-0',
      active
        ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)] animate-pulse'
        : 'bg-white/10'
    )} />
  );
}

function QueueBadge({ position }: { position?: number }) {
  if (!position) return (
    <Badge variant="outline" className="text-[8px] border-white/10 text-white/20 h-5 px-2 font-black uppercase">
      Aguardando
    </Badge>
  );
  return (
    <Badge variant="outline" className="text-[8px] bg-kinetic-orange/10 border-kinetic-orange/20 text-kinetic-orange h-5 px-2 font-black uppercase">
      #{position} na fila
    </Badge>
  );
}

function EmptyState({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-20">
      <Icon className="w-8 h-8" />
      <p className="text-[10px] font-black uppercase tracking-widest text-center">{label}</p>
    </div>
  );
}

function SkeletonRow() {
  return <div className="h-14 rounded-2xl bg-white/5 animate-pulse" />;
}

// ─── Componente de Fonte de Automação ────────────────────────────────────────

function SourceCard({
  source,
  queuePositions,
  activeCampaigns,
}: {
  source: AutomationSource;
  queuePositions: Record<string, number>;
  activeCampaigns: Campaign[];
}) {
  const linkedCampaign = activeCampaigns.find(c =>
    c.name.toLowerCase().includes(source.name.toLowerCase())
  );
  const queuePos = linkedCampaign ? queuePositions[linkedCampaign.id] : undefined;
  const routeCount = source.automation_routes?.length || 0;

  return (
    <div className="flex items-center justify-between p-4 rounded-2xl bg-deep-void shadow-skeuo-pressed gap-4">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <StatusDot active={source.is_active} />
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-tight text-white/80 truncate">
            {source.name}
          </p>
          <p className="text-[9px] font-bold text-white/20 uppercase mt-0.5">
            {routeCount} rota{routeCount !== 1 ? 's' : ''} • {formatRelativeTime(source.created_at)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <QueueBadge position={queuePos} />
        <Badge
          variant="outline"
          className={cn(
            'text-[8px] h-5 px-2 font-black uppercase border',
            source.is_active
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-white/5 text-white/20 border-white/5'
          )}
        >
          {source.is_active ? 'Ativo' : 'Inativo'}
        </Badge>
      </div>
    </div>
  );
}

// ─── Componente de Job na Fila ───────────────────────────────────────────────

function JobRow({ job, position }: { job: SendJob; position: number }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-deep-void shadow-skeuo-pressed">
      <span className="text-[10px] font-black text-kinetic-orange w-6 text-center shrink-0">
        #{position}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase text-white/60 truncate">
          {job.destination}
        </p>
        <p className="text-[8px] font-bold text-white/20 uppercase">
          {formatRelativeTime(job.created_at)}
        </p>
      </div>
      <Badge
        variant="outline"
        className={cn(
          'text-[8px] h-4 px-1.5 font-black uppercase border shrink-0',
          job.status === 'processing'
            ? 'bg-kinetic-orange/10 text-kinetic-orange border-kinetic-orange/20'
            : 'bg-white/5 text-white/20 border-white/5'
        )}
      >
        {job.status === 'processing' ? 'Enviando' : 'Fila'}
      </Badge>
    </div>
  );
}

// ─── Componente de Log ───────────────────────────────────────────────────────

function LogRow({ log }: { log: AutomationLog }) {
  const isOk = log.status === 'processed' || log.status === 'captured';
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-deep-void shadow-skeuo-pressed">
      <div className={cn(
        'w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5',
        isOk ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
      )}>
        {isOk ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase text-white/60 truncate">
          {log.event_type}
        </p>
        <p className="text-[8px] font-bold text-white/20 uppercase">
          {formatRelativeTime(log.created_at)}
        </p>
      </div>
      <Badge
        variant="outline"
        className={cn(
          'text-[8px] h-4 px-1.5 font-black uppercase border shrink-0',
          isOk
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-red-500/10 text-red-400 border-red-500/20'
        )}
      >
        {log.status}
      </Badge>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MonitoramentoPage() {
  const { user } = useAuth();
  const [data, setData] = useState<MonitoringData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!user?.id) return;
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const res = await fetch('/api/monitoring/queue', {
        headers: { 'x-user-id': user.id },
      });
      if (!res.ok) throw new Error('Falha ao carregar monitoramento');
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
    // Auto-refresh a cada 30 segundos
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const allSources = [...(data?.groupSources || []), ...(data?.radarSources || [])];

  return (
    <LayoutContainer type="operational">
      <PageHeader
        title="Monitoramento"
        description="Acompanhe a fila de envios, automações de grupos e o Radar em tempo real."
        icon={<Activity size={24} />}
      />

      {/* Header de status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-full border border-white/5 shadow-skeuo-pressed">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-[9px] text-emerald-500 font-black uppercase tracking-widest">Live</span>
          </div>
          {lastUpdated && (
            <span className="text-[9px] text-white/20 font-bold uppercase">
              Atualizado {formatRelativeTime(lastUpdated.toISOString())}
            </span>
          )}
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 shadow-skeuo-pressed hover:bg-white/10 transition-all text-white/40 hover:text-white"
        >
          <RefreshCw className={cn('w-3 h-3', isRefreshing && 'animate-spin')} />
          <span className="text-[9px] font-black uppercase tracking-widest">Atualizar</span>
        </button>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Na Fila',
            value: data?.totalPending ?? 0,
            icon: Clock,
            color: 'text-kinetic-orange',
            bg: 'bg-kinetic-orange/10',
            border: 'border-kinetic-orange/20',
          },
          {
            label: 'Grupos Ativos',
            value: data?.groupSources.filter(s => s.is_active).length ?? 0,
            icon: Users,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/20',
          },
          {
            label: 'Radar Ativo',
            value: data?.radarSources.filter(s => s.is_active).length ?? 0,
            icon: Radar,
            color: 'text-purple-400',
            bg: 'bg-purple-500/10',
            border: 'border-purple-500/20',
          },
          {
            label: 'Logs 24h',
            value: data?.recentLogs.length ?? 0,
            icon: Activity,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/20',
          },
        ].map(({ label, value, icon: Icon, color, bg, border }) => (
          <TactileCard key={label} className="p-4 border-none">
            <div className="flex items-center gap-3">
              <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shadow-skeuo-flat', bg, `border ${border}`)}>
                <Icon className={cn('w-4 h-4', color)} />
              </div>
              <div>
                {isLoading
                  ? <div className="h-6 w-12 rounded bg-white/10 animate-pulse" />
                  : <p className="text-xl font-black text-white">{value}</p>
                }
                <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{label}</p>
              </div>
            </div>
          </TactileCard>
        ))}
      </div>

      {/* Tabs principais */}
      <Tabs defaultValue="grupos" className="w-full">
        <TabsList className="mb-6 bg-deep-void/50 shadow-skeuo-pressed p-1 rounded-2xl border-none h-12">
          <TabsTrigger
            value="grupos"
            className="text-[10px] font-black uppercase tracking-[0.2em] px-6 h-full rounded-xl data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-400 data-[state=active]:shadow-skeuo-pressed font-headline italic flex items-center gap-2"
          >
            <Users className="w-3.5 h-3.5" /> Grupos
          </TabsTrigger>
          <TabsTrigger
            value="radar"
            className="text-[10px] font-black uppercase tracking-[0.2em] px-6 h-full rounded-xl data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-400 data-[state=active]:shadow-skeuo-pressed font-headline italic flex items-center gap-2"
          >
            <Radar className="w-3.5 h-3.5" /> Radar
          </TabsTrigger>
          <TabsTrigger
            value="fila"
            className="text-[10px] font-black uppercase tracking-[0.2em] px-6 h-full rounded-xl data-[state=active]:bg-kinetic-orange/10 data-[state=active]:text-kinetic-orange data-[state=active]:shadow-skeuo-pressed font-headline italic flex items-center gap-2"
          >
            <Layers className="w-3.5 h-3.5" /> Fila Geral
          </TabsTrigger>
          <TabsTrigger
            value="logs"
            className="text-[10px] font-black uppercase tracking-[0.2em] px-6 h-full rounded-xl data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-400 data-[state=active]:shadow-skeuo-pressed font-headline italic flex items-center gap-2"
          >
            <Activity className="w-3.5 h-3.5" /> Logs
          </TabsTrigger>
        </TabsList>

        {/* Tab Grupos */}
        <TabsContent value="grupos" className="mt-0">
          <TactileCard className="p-6 border-none">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shadow-skeuo-flat border border-blue-500/20">
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] font-headline italic text-white/90">
                  Automações de Grupos
                </h3>
                <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                  Monitoramento de grupos WhatsApp
                </p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-5" />
            <div className="space-y-2">
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
                : data?.groupSources.length === 0
                ? <EmptyState icon={Users} label="Nenhuma automação de grupo configurada" />
                : data?.groupSources.map(source => (
                  <SourceCard
                    key={source.id}
                    source={source}
                    queuePositions={data.queuePositions}
                    activeCampaigns={data.activeCampaigns}
                  />
                ))
              }
            </div>
          </TactileCard>
        </TabsContent>

        {/* Tab Radar */}
        <TabsContent value="radar" className="mt-0">
          <TactileCard className="p-6 border-none">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center shadow-skeuo-flat border border-purple-500/20">
                <Radar className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] font-headline italic text-white/90">
                  Automações do Radar
                </h3>
                <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                  Disparos automáticos de ofertas descobertas
                </p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-5" />
            <div className="space-y-2">
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
                : data?.radarSources.length === 0
                ? <EmptyState icon={Radar} label="Nenhuma automação do Radar configurada" />
                : data?.radarSources.map(source => (
                  <SourceCard
                    key={source.id}
                    source={source}
                    queuePositions={data.queuePositions}
                    activeCampaigns={data.activeCampaigns}
                  />
                ))
              }
            </div>
          </TactileCard>
        </TabsContent>

        {/* Tab Fila Geral */}
        <TabsContent value="fila" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fila de Jobs */}
            <TactileCard className="p-6 border-none">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-kinetic-orange/10 flex items-center justify-center shadow-skeuo-flat border border-kinetic-orange/20">
                  <Clock className="w-4 h-4 text-kinetic-orange" />
                </div>
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] font-headline italic text-white/90">
                    Jobs na Fila
                  </h3>
                  <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                    {data?.totalPending || 0} pendentes
                  </p>
                </div>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-5" />
              <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                  : data?.pendingJobs.length === 0
                  ? <EmptyState icon={Clock} label="Nenhum job pendente" />
                  : data?.pendingJobs.map((job, index) => (
                    <JobRow key={job.id} job={job} position={index + 1} />
                  ))
                }
              </div>
            </TactileCard>

            {/* Campanhas Ativas */}
            <TactileCard className="p-6 border-none">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shadow-skeuo-flat border border-emerald-500/20">
                  <Zap className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] font-headline italic text-white/90">
                    Campanhas em Execução
                  </h3>
                  <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                    Broadcasts ativos agora
                  </p>
                </div>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-5" />
              <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                {isLoading
                  ? Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)
                  : data?.activeCampaigns.length === 0
                  ? <EmptyState icon={Zap} label="Nenhuma campanha em execução" />
                  : data?.activeCampaigns.map((campaign) => {
                    const pos = data.queuePositions[campaign.id];
                    return (
                      <div key={campaign.id} className="flex items-center justify-between p-4 rounded-2xl bg-deep-void shadow-skeuo-pressed gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-black uppercase tracking-tight text-white/80 truncate">
                            {campaign.name}
                          </p>
                          <p className="text-[9px] font-bold text-white/20 uppercase mt-0.5">
                            {campaign.total_destinations} destinos
                          </p>
                        </div>
                        <QueueBadge position={pos} />
                      </div>
                    );
                  })
                }
              </div>
            </TactileCard>
          </div>
        </TabsContent>

        {/* Tab Logs */}
        <TabsContent value="logs" className="mt-0">
          <TactileCard className="p-6 border-none">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shadow-skeuo-flat border border-emerald-500/20">
                <Activity className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] font-headline italic text-white/90">
                  Logs de Automação
                </h3>
                <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                  Últimas 24 horas
                </p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-5" />
            <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                : data?.recentLogs.length === 0
                ? <EmptyState icon={Activity} label="Nenhum log nas últimas 24 horas" />
                : data?.recentLogs.map(log => (
                  <LogRow key={log.id} log={log} />
                ))
              }
            </div>
          </TactileCard>
        </TabsContent>
      </Tabs>
    </LayoutContainer>
  );
}
