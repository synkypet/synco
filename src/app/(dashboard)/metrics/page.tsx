"use client";

import React, { useEffect, useState } from 'react';
import { TactileCard } from '@/components/ui/TactileCard';
import { KineticButton } from '@/components/ui/KineticButton';
import { RefreshCw, Plus, Settings, TrendingUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRouter } from 'next/navigation';

interface GroupData {
  id: string;
  name: string;
  channel_id: string;
  remote_id: string;
  monitor_id: string | null;
  is_monitored: boolean;
  last_poll_status: string | null;
  last_snapshot_at: string | null;
}

interface MonitoredGroup {
  monitorId: string;
  groupId: string;
  groupName: string;
  enabled: boolean;
  memberCount: number;
  lastSnapshotAt: string | null;
  hasSnapshot: boolean;
  hasDeltas: boolean;
  growth24h: number;
  joined24h: number;
  left24h: number;
  lastPollStatus: string | null;
  lastErrorMessage: string | null;
  nextPollAt: string | null;
}

interface SummaryData {
  activeCount: number;
  limit: number;
  monitoredMembersTotal: number;
  growth24h: number;
  estimatedJoined24h: number;
  estimatedLeft24h: number;
  lastUpdatedAt: string | null;
  monitoredGroups: MonitoredGroup[];
}

export default function SyncoMetricsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);

  // Meta Ads states
  const [metaConnection, setMetaConnection] = useState<any>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');

  const loadMetrics = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const [groupsRes, summaryRes, metaRes] = await Promise.all([
        fetch('/api/synco-metrics/groups'),
        fetch('/api/synco-metrics/summary'),
        fetch('/api/synco-metrics/meta/connection')
      ]);

      if (!groupsRes.ok) {
        const errorData = await groupsRes.json();
        throw new Error(errorData.error || 'Erro ao carregar grupos');
      }

      if (!summaryRes.ok) {
        const errorData = await summaryRes.json();
        throw new Error(errorData.error || 'Erro ao carregar sumário');
      }

      const groupsData = await groupsRes.json();
      const summaryData = await summaryRes.json();
      
      if (metaRes.ok) {
        const metaData = await metaRes.json();
        if (metaData.connected) {
          setMetaConnection(metaData.account);
        } else {
          setMetaConnection(null);
        }
      }

      setGroups(groupsData.groups);
      setSummary(summaryData);
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      setError(err.message);
      if (isRefresh) {
        alert("Não foi possível atualizar as métricas agora.");
      }
    } finally {
      if (isRefresh) {
        setIsRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const handleToggleMonitor = async (groupId: string, channelId: string, isCurrentlyMonitored: boolean, monitorId?: string | null) => {
    try {
      const activeCount = summary?.activeCount || 0;
      const limit = summary?.limit || 3;

      if (!isCurrentlyMonitored && activeCount >= limit) {
        alert(`Você já atingiu o limite máximo de ${limit} grupos monitorados.`);
        return;
      }

      let response;
      if (!isCurrentlyMonitored) {
        response = await fetch('/api/synco-metrics/monitored-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_id: groupId, channel_id: channelId })
        });
      } else {
        if (!monitorId) throw new Error("Monitor ID não encontrado");
        response = await fetch(`/api/synco-metrics/monitored-groups/${monitorId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: false })
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        alert(`Erro: ${errorData.error}`);
        return;
      }
      
      setIsAddGroupModalOpen(false);
      loadMetrics();
    } catch (err: any) {
      alert(`Erro interno: ${err.message}`);
      loadMetrics();
    }
  };

  const renderDeltaText = (hasSnapshot: boolean, hasDeltas: boolean, growth24h: number) => {
    if (!hasSnapshot) return "Aguardando";
    if (!hasDeltas) return "Sem dados suficientes";
    if (growth24h === 0) return "Sem variação";
    if (growth24h > 0) return `+${growth24h}`;
    return `${growth24h}`;
  };

  const renderDeltaColor = (growth24h: number) => {
    if (growth24h > 0) return "text-emerald-400";
    if (growth24h < 0) return "text-red-400";
    return "text-zinc-400";
  };

  if (loading && groups.length === 0) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <p className="text-zinc-500 animate-pulse">Carregando SyncoMetrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <TactileCard className="p-6 border-red-900/30 bg-red-900/10">
          <h2 className="text-red-500 text-xl font-bold mb-2">Acesso Restrito</h2>
          <p className="text-zinc-400">{error}</p>
        </TactileCard>
      </div>
    );
  }

  const activeCount = summary?.activeCount || 0;
  const limit = summary?.limit || 3;
  const monitoredGroups = summary?.monitoredGroups || [];
  
  // Grupos disponíveis
  const availableGroups = groups.filter(g => !g.is_monitored);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">SyncoMetrics</h1>
          <p className="text-zinc-400 mt-2 text-sm max-w-xl">
            A Meta mede leads/cliques. O SyncoMetrics mede membros reais. Compare os resultados da Meta Ads com entradas reais nos seus grupos.
          </p>
          <div className="flex items-center gap-3 mt-4 text-xs">
            <span className="flex items-center gap-1 text-zinc-500">
              <span className={`w-2 h-2 rounded-full ${metaConnection ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
              Meta Ads: {metaConnection ? 'Conectado' : 'Não conectado'}
            </span>
            <span className="text-zinc-700">•</span>
            <span className="text-zinc-500">
              Worker: {summary?.lastUpdatedAt ? `Última coleta às ${new Date(summary.lastUpdatedAt).toLocaleTimeString('pt-BR')}` : 'Aguardando coleta'}
            </span>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-2">
            <select 
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm rounded-lg px-3 py-2 outline-none focus:border-kinetic-orange"
            >
              <option value="today">Hoje</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="custom" disabled>Personalizado</option>
            </select>
            
            <KineticButton 
              onClick={() => loadMetrics(true)} 
              disabled={isRefreshing}
              className="flex items-center gap-2 bg-zinc-800 text-zinc-200 hover:text-white px-3 py-2 h-[38px]"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-kinetic-orange' : ''}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'Atualizando...' : 'Atualizar'}</span>
            </KineticButton>

            <KineticButton 
              onClick={() => router.push('/configuracoes?tab=metrics')} 
              className="flex items-center gap-2 bg-zinc-800 text-zinc-200 hover:text-white px-3 py-2 h-[38px]"
              title="Configurar SyncoMetrics"
            >
              <Settings className="w-4 h-4" />
            </KineticButton>
          </div>
          {lastRefreshedAt && (
            <span className="text-xs text-zinc-500 font-medium">
              Última atualização da tela: {lastRefreshedAt.toLocaleTimeString('pt-BR')}
            </span>
          )}
        </div>
      </div>

      {/* Cards Principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <TactileCard className="p-4">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Gasto Meta</p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-bold text-zinc-500">
              {metaConnection ? 'Aguardando métricas' : 'Em breve'}
            </span>
          </div>
        </TactileCard>

        <TactileCard className="p-4">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Leads informados (Meta)</p>
          <p className="mt-2 text-xl font-bold text-zinc-500">
            {metaConnection ? 'Aguardando métricas' : 'Em breve'}
          </p>
        </TactileCard>

        <TactileCard className="p-4">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Entradas reais no grupo</p>
          <p className={`mt-2 text-2xl font-bold ${summary?.growth24h && summary.growth24h > 0 ? 'text-emerald-400' : 'text-zinc-100'}`}>
            {summary?.growth24h !== undefined ? (summary.growth24h > 0 ? `+${summary.growth24h}` : summary.growth24h) : 0}
          </p>
          <p className="text-xs text-zinc-500 mt-1">Neste período</p>
        </TactileCard>

        <TactileCard className="p-4 border-kinetic-orange/20 bg-kinetic-orange/5">
          <p className="text-[10px] text-kinetic-orange uppercase tracking-wider font-semibold">Custo real por membro</p>
          <p className="mt-2 text-xl font-bold text-zinc-500">
            Em breve
          </p>
        </TactileCard>
      </div>

      {/* Bloco de Comparação */}
      <TactileCard className="p-6 border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-zinc-900/30">
        <div className="flex flex-col md:flex-row gap-8 items-center justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-zinc-200 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-kinetic-orange" />
              Meta Ads x Grupo Real
            </h2>
            <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
              A Meta mostra o resultado do anúncio. O SyncoMetrics compara isso com a entrada real nos grupos monitorados.
            </p>
          </div>
          
          <div className="flex-1 grid grid-cols-2 gap-4 w-full">
            <div className="bg-zinc-950/50 p-4 rounded-lg border border-zinc-800/50">
              <span className="text-xs text-zinc-500 block mb-1">A Meta informou:</span>
              <span className="text-lg font-semibold text-zinc-300">-- leads</span>
              <span className="text-xs text-zinc-600 block mt-2">Custo/Lead: --</span>
            </div>
            <div className="bg-zinc-950/50 p-4 rounded-lg border border-kinetic-orange/20">
              <span className="text-xs text-zinc-500 block mb-1">O Grupo ganhou:</span>
              <span className="text-lg font-semibold text-emerald-400">
                {summary?.growth24h !== undefined ? (summary.growth24h > 0 ? `+${summary.growth24h}` : summary.growth24h) : 0} membros
              </span>
              <span className="text-xs text-zinc-600 block mt-2">Custo real: --</span>
            </div>
          </div>
        </div>
      </TactileCard>

      {/* Grupos Monitorados Compactos */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-zinc-200">Grupos Monitorados</h2>
            <p className="text-xs text-zinc-500 mt-1">{activeCount} de {limit} grupos permitidos no seu plano</p>
          </div>
          
          <Dialog open={isAddGroupModalOpen} onOpenChange={setIsAddGroupModalOpen}>
            <DialogTrigger asChild>
              <KineticButton disabled={activeCount >= limit} className="flex items-center gap-2 text-sm py-2 px-3">
                <Plus className="w-4 h-4" />
                Adicionar grupo
              </KineticButton>
            </DialogTrigger>
            <DialogContent className="bg-deep-void border-zinc-800 max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-zinc-100">Adicionar grupo ao monitoramento</DialogTitle>
              </DialogHeader>
              <div className="mt-4 space-y-3">
                {availableGroups.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-8">Não há grupos elegíveis disponíveis para monitoramento.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {availableGroups.map(group => (
                      <div key={group.id} className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col justify-between">
                        <span className="text-sm text-zinc-200 font-medium truncate mb-3" title={group.name}>{group.name}</span>
                        <KineticButton 
                          onClick={() => handleToggleMonitor(group.id, group.channel_id, false)}
                          className="w-full text-xs py-1.5 bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700"
                        >
                          Ativar
                        </KineticButton>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {monitoredGroups.length === 0 ? (
          <TactileCard className="p-6 text-center bg-zinc-900/30 border-dashed border-zinc-800">
            <p className="text-zinc-500 text-sm">Nenhum grupo sendo monitorado. Adicione um grupo para começar a medir as entradas reais.</p>
          </TactileCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {monitoredGroups.map(monitor => (
              <TactileCard key={monitor.monitorId} className="p-4 ring-1 ring-kinetic-orange/20 hover:ring-kinetic-orange/40 transition-all flex flex-col justify-between group">
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h3 className="font-medium text-zinc-200 text-sm line-clamp-1" title={monitor.groupName}>{monitor.groupName}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div>
                      <span className="block text-[10px] text-zinc-500">Membros</span>
                      <span className="text-sm font-medium text-zinc-300">{monitor.hasSnapshot ? monitor.memberCount : '---'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-zinc-500">Variação</span>
                      <span className={`text-sm font-medium ${renderDeltaColor(monitor.growth24h)}`}>
                        {renderDeltaText(monitor.hasSnapshot, monitor.hasDeltas, monitor.growth24h)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-600 truncate">
                    Última coleta: {monitor.lastSnapshotAt ? new Date(monitor.lastSnapshotAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '---'}
                  </span>
                  <button 
                    onClick={() => handleToggleMonitor(monitor.groupId, '', true, monitor.monitorId)}
                    className="text-[10px] text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity uppercase font-semibold"
                  >
                    Desativar
                  </button>
                </div>
              </TactileCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
