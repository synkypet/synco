"use client";

import React, { useEffect, useState } from 'react';
import { TactileCard } from '@/components/ui/TactileCard';
import { KineticButton } from '@/components/ui/KineticButton';

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

interface SummaryData {
  active_monitors: number;
  last_snapshot_at: string | null;
  growth_24h: number | null;
  last_poll_status: string;
  status_code: string;
}

export default function SyncoMetricsPage() {
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [limit, setLimit] = useState<number>(3);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [groupsRes, summaryRes] = await Promise.all([
        fetch('/api/synco-metrics/groups'),
        fetch('/api/synco-metrics/summary')
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

      setGroups(groupsData.groups);
      setLimit(groupsData.limit);
      setActiveCount(groupsData.activeCount);
      setSummary(summaryData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleMonitor = async (group: GroupData) => {
    try {
      const isCurrentlyMonitored = group.is_monitored;
      
      // Se for tentar ativar e já estourou o limite, barra na UI antes da API
      if (!isCurrentlyMonitored && activeCount >= limit) {
        alert(`Você já atingiu o limite máximo de ${limit} grupos monitorados.`);
        return;
      }

      const originalGroups = [...groups];
      const originalCount = activeCount;

      // Optimistic update
      setGroups(prev => prev.map(g => {
        if (g.id === group.id) {
          return { ...g, is_monitored: !isCurrentlyMonitored };
        }
        return g;
      }));
      setActiveCount(prev => isCurrentlyMonitored ? prev - 1 : prev + 1);

      let response;
      if (!isCurrentlyMonitored) {
        // Ativar -> POST
        response = await fetch('/api/synco-metrics/monitored-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_id: group.id, channel_id: group.channel_id })
        });
      } else {
        // Desativar -> PATCH enabled = false
        if (!group.monitor_id) throw new Error("Monitor ID não encontrado");
        response = await fetch(`/api/synco-metrics/monitored-groups/${group.monitor_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: false })
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        // Reverte em caso de erro
        setGroups(originalGroups);
        setActiveCount(originalCount);
        alert(`Erro: ${errorData.error}`);
        return;
      }

      // Se foi sucesso mas não tínhamos o monitor_id (criação nova), refetch para pegar os novos IDs do banco
      if (!isCurrentlyMonitored && !group.monitor_id) {
        fetchData();
      }

    } catch (err: any) {
      alert(`Erro interno: ${err.message}`);
      fetchData(); // Sincroniza em caso de erro
    }
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

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">SyncoMetrics</h1>
          <p className="text-zinc-400 mt-2">Monitore o crescimento dos seus grupos e acompanhe membros reais.</p>
        </div>
        <div className="flex items-center gap-4">
          <TactileCard className="px-4 py-2 flex items-center gap-3">
            <span className="text-sm text-zinc-500 font-medium uppercase tracking-wider">Grupos Ativos</span>
            <span className={`text-xl font-bold ${activeCount >= limit ? 'text-kinetic-orange' : 'text-zinc-100'}`}>
              {activeCount} <span className="text-zinc-600 text-sm font-normal">/ {limit}</span>
            </span>
          </TactileCard>
        </div>
      </div>

      {/* Summary Banner (Placeholder for worker) */}
      {summary && (
        <TactileCard className="p-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-kinetic-orange/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="h-2 w-2 rounded-full bg-kinetic-orange animate-pulse shadow-glow-orange" />
            <p className="text-zinc-300 font-medium">Status do Processamento: <span className="text-zinc-500 font-normal ml-2">{summary.last_poll_status}</span></p>
          </div>
        </TactileCard>
      )}

      {/* Group List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-zinc-200 mb-4">Seus Grupos ({groups.length})</h2>
        
        {groups.length === 0 ? (
          <TactileCard className="p-12 text-center">
            <p className="text-zinc-500">Nenhum grupo encontrado no SYNCO. Sincronize grupos no menu Canais primeiro.</p>
          </TactileCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map(group => (
              <TactileCard key={group.id} className={`p-5 transition-all duration-300 ${group.is_monitored ? 'ring-1 ring-kinetic-orange/30 shadow-glow-orange/20' : ''}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-zinc-100 text-lg truncate max-w-[250px]">{group.name}</h3>
                    <p className="text-xs text-zinc-500 mt-1">ID: {group.remote_id || 'N/A'}</p>
                  </div>
                  {/* Badge de membros removido para otimização e limpeza visual conforme regras. */}
                </div>

                <div className="flex justify-between items-center mt-6">
                  <div>
                    {group.is_monitored ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-kinetic-orange flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-kinetic-orange shadow-glow-orange" />
                          Monitorando
                        </span>
                        <span className="text-[10px] text-zinc-500">Membros: aguardando worker</span>
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-zinc-500">Inativo</span>
                    )}
                  </div>
                  
                  <KineticButton 
                    onClick={() => handleToggleMonitor(group)}
                    disabled={!group.is_monitored && activeCount >= limit}
                    className={
                      (!group.is_monitored && activeCount >= limit ? 'opacity-50 cursor-not-allowed ' : '') +
                      (group.is_monitored ? 'bg-zinc-800 text-zinc-300 shadow-skeuo-pressed' : '')
                    }
                  >
                    {group.is_monitored ? 'Desativar Monitoramento' : 'Ativar Monitoramento'}
                  </KineticButton>
                </div>
              </TactileCard>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
