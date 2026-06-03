"use client";

import React, { useEffect, useState } from 'react';
import { TactileCard } from '@/components/ui/TactileCard';
import { KineticButton } from '@/components/ui/KineticButton';
import { RefreshCw } from 'lucide-react';

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
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Meta Ads states
  const [metaConnection, setMetaConnection] = useState<any>(null);
  const [metaToken, setMetaToken] = useState('');
  const [metaAccountId, setMetaAccountId] = useState('');
  const [metaPixelId, setMetaPixelId] = useState('');
  const [isTestingMeta, setIsTestingMeta] = useState(false);
  const [metaTestError, setMetaTestError] = useState<string | null>(null);

  const handleTestMeta = async () => {
    if (!metaToken || !metaAccountId) {
      setMetaTestError("Preencha o Token e o Ad Account ID.");
      return;
    }
    
    setIsTestingMeta(true);
    setMetaTestError(null);

    try {
      const res = await fetch('/api/synco-metrics/meta/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: metaToken,
          adAccountId: metaAccountId,
          pixelId: metaPixelId
        })
      });

      const data = await res.json();
      setMetaToken(''); // Limpa token

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Erro desconhecido na conexão Meta');
      }

      setMetaConnection(data.account);
    } catch (err: any) {
      setMetaTestError(err.message);
    } finally {
      setIsTestingMeta(false);
    }
  };

  const handleDisconnectMeta = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/synco-metrics/meta/connection', {
        method: 'DELETE'
      });
      if (res.ok) {
        setMetaConnection(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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

      loadMetrics();
    } catch (err: any) {
      alert(`Erro interno: ${err.message}`);
      loadMetrics();
    }
  };

  const renderDeltaText = (hasSnapshot: boolean, hasDeltas: boolean, growth24h: number) => {
    if (!hasSnapshot) return "Aguardando primeira coleta";
    if (!hasDeltas) return "Sem dados suficientes";
    if (growth24h === 0) return "Sem variação";
    if (growth24h > 0) return `+${growth24h} membros`;
    return `${growth24h} membros`;
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
  
  // Grupos que ainda não estão sendo monitorados
  const availableGroups = groups.filter(g => !g.is_monitored);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-12 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">SyncoMetrics</h1>
          <p className="text-zinc-400 mt-2">Monitore o crescimento dos seus grupos e compare com suas campanhas.</p>
        </div>
        <div className="flex items-center gap-4">
          {lastRefreshedAt && (
            <span className="text-xs text-zinc-500 font-medium">
              Atualizado: {lastRefreshedAt.toLocaleTimeString('pt-BR')}
            </span>
          )}
          <KineticButton 
            onClick={() => loadMetrics(true)} 
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-zinc-800 text-zinc-200 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-kinetic-orange' : ''}`} />
            {isRefreshing ? 'Atualizando...' : 'Atualizar'}
          </KineticButton>
        </div>
      </div>

      {/* Bloco 2: Resumo Geral */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <TactileCard className="p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Grupos Ativos</p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className={`text-2xl font-bold ${activeCount >= limit ? 'text-kinetic-orange' : 'text-zinc-100'}`}>
              {activeCount}
            </span>
            <span className="text-zinc-500 text-sm">/ {limit}</span>
          </div>
        </TactileCard>

        <TactileCard className="p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Membros Monitorados</p>
          <p className="mt-2 text-2xl font-bold text-zinc-100">
            {summary?.monitoredMembersTotal || 0}
          </p>
        </TactileCard>

        <TactileCard className="p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Crescimento 24h</p>
          <p className={`mt-2 text-2xl font-bold ${renderDeltaColor(summary?.growth24h || 0)}`}>
            {summary?.growth24h !== undefined ? (summary.growth24h > 0 ? `+${summary.growth24h}` : summary.growth24h) : 0}
          </p>
        </TactileCard>

        <TactileCard className="p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Última Coleta</p>
          <p className="mt-2 text-sm font-medium text-zinc-300">
            {summary?.lastUpdatedAt ? new Date(summary.lastUpdatedAt).toLocaleString('pt-BR') : 'Aguardando dados'}
          </p>
        </TactileCard>
      </div>

      {/* Bloco 1: Grupos Monitorados */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-zinc-200">Grupos Monitorados</h2>
        {monitoredGroups.length === 0 ? (
          <TactileCard className="p-8 text-center bg-zinc-900/50">
            <p className="text-zinc-500">Nenhum grupo sendo monitorado no momento.</p>
          </TactileCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {monitoredGroups.map(monitor => (
              <TactileCard key={monitor.monitorId} className="p-5 ring-1 ring-kinetic-orange/30 shadow-glow-orange/10 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4 gap-2">
                    <h3 className="font-semibold text-zinc-100 text-base line-clamp-2">{monitor.groupName}</h3>
                    <span className="text-[10px] uppercase font-bold text-kinetic-orange bg-kinetic-orange/10 px-2 py-1 rounded-sm shrink-0">
                      Monitorando
                    </span>
                  </div>

                  <div className="space-y-3 mt-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-500">Membros:</span>
                      <span className="text-zinc-200 font-medium">{monitor.hasSnapshot ? monitor.memberCount : '---'}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-zinc-500">Variação 24h:</span>
                      <span className={`font-medium ${renderDeltaColor(monitor.growth24h)}`}>
                        {renderDeltaText(monitor.hasSnapshot, monitor.hasDeltas, monitor.growth24h)}
                      </span>
                    </div>
                    {monitor.hasDeltas && (
                      <div className="flex justify-between items-center text-xs text-zinc-500">
                        <span>Entraram: <span className="text-emerald-400">+{monitor.joined24h}</span></span>
                        <span>Saíram: <span className="text-red-400">-{monitor.left24h}</span></span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-500">Status Worker:</span>
                      <span className={monitor.lastPollStatus === 'failed' ? 'text-red-400' : 'text-zinc-400'}>
                        {monitor.lastPollStatus || 'Pendente'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-800">
                  <KineticButton 
                    onClick={() => handleToggleMonitor(monitor.groupId, '', true, monitor.monitorId)}
                    className="w-full bg-zinc-800 text-zinc-300 hover:text-white text-sm py-2"
                  >
                    Desativar Monitoramento
                  </KineticButton>
                </div>
              </TactileCard>
            ))}
          </div>
        )}
      </div>

      {/* Bloco 3: Grupos Disponíveis */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-zinc-200">Adicionar grupos ao monitoramento</h2>
        {availableGroups.length === 0 ? (
          <TactileCard className="p-8 text-center bg-zinc-900/50">
            <p className="text-zinc-500">Todos os seus grupos elegíveis já estão sendo monitorados ou não há grupos disponíveis.</p>
          </TactileCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableGroups.map(group => (
              <TactileCard key={group.id} className="p-4 flex flex-col justify-between">
                <div className="mb-4">
                  <h3 className="font-medium text-zinc-200 text-sm truncate">{group.name}</h3>
                  <span className="text-xs text-zinc-500 mt-1 block">Inativo</span>
                </div>
                
                <KineticButton 
                  onClick={() => handleToggleMonitor(group.id, group.channel_id, false)}
                  disabled={activeCount >= limit}
                  className={`w-full text-sm py-2 ${activeCount >= limit ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Ativar Monitoramento
                </KineticButton>
              </TactileCard>
            ))}
          </div>
        )}
      </div>

      {/* Teste de Conexão Meta Ads */}
      <div className="mt-16 pt-8 border-t border-zinc-800/50">
        <TactileCard className="p-8 relative overflow-hidden bg-zinc-900/30 border-zinc-800/50">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12c0-5.523-4.477-10-10-10z"/>
            </svg>
          </div>
          
          <div className="relative z-10 max-w-2xl">
            <h2 className="text-2xl font-bold text-zinc-300 flex items-center gap-2">
              Meta Ads <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded-sm uppercase tracking-wider font-semibold">Modo Teste (MVP)</span>
            </h2>
            <p className="text-zinc-500 mt-2 text-sm leading-relaxed mb-6">
              Valide sua conexão em modo read-only. Para este teste, use um token Meta com permissão <strong>ads_read</strong> e acesso à conta de anúncios informada.
            </p>

            {metaConnection ? (
              <div className="space-y-4 animate-fade-in">
                <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-zinc-200 font-semibold flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      Conectado
                    </h3>
                    <ul className="text-sm text-zinc-400 mt-2 space-y-1">
                      <li><strong>Conta:</strong> {metaConnection.name} ({metaConnection.adAccountId})</li>
                      <li><strong>Moeda:</strong> {metaConnection.currency}</li>
                      {metaConnection.pixelName && (
                        <li><strong>Pixel:</strong> {metaConnection.pixelName}</li>
                      )}
                      <li><strong>Último Teste:</strong> {new Date(metaConnection.lastTestedAt).toLocaleString('pt-BR')}</li>
                    </ul>
                  </div>
                  <div className="flex flex-col gap-2 w-full sm:w-auto">
                    <KineticButton 
                      onClick={() => setMetaConnection(null)} 
                      className="bg-zinc-800 text-zinc-300 w-full"
                    >
                      Trocar Conta/Token
                    </KineticButton>
                    <KineticButton 
                      onClick={handleDisconnectMeta} 
                      className="bg-red-900/20 text-red-400 hover:bg-red-900/40 border border-red-900/50 w-full"
                    >
                      Desconectar
                    </KineticButton>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in">
                {metaTestError && (
                  <div className="p-3 bg-red-900/20 border border-red-900/50 text-red-400 text-sm rounded-lg">
                    {metaTestError}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">ID da Conta de Anúncios</label>
                    <input 
                      type="text" 
                      placeholder="act_123456789" 
                      value={metaAccountId}
                      onChange={(e) => setMetaAccountId(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-kinetic-orange transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Pixel ID (Opcional)</label>
                    <input 
                      type="text" 
                      placeholder="987654321" 
                      value={metaPixelId}
                      onChange={(e) => setMetaPixelId(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-kinetic-orange transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Access Token (User ou System Token)</label>
                  <input 
                    type="password" 
                    placeholder="EAAB..." 
                    value={metaToken}
                    onChange={(e) => setMetaToken(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-kinetic-orange transition-colors font-mono"
                  />
                </div>
                <div className="pt-2">
                  <KineticButton 
                    onClick={handleTestMeta} 
                    disabled={isTestingMeta || !metaToken || !metaAccountId}
                    className="flex items-center gap-2"
                  >
                    {isTestingMeta && <RefreshCw className="w-4 h-4 animate-spin" />}
                    {isTestingMeta ? 'Conectando...' : 'Conectar Conta Meta Ads'}
                  </KineticButton>
                </div>
              </div>
            )}

          </div>
        </TactileCard>
      </div>

    </div>
  );
}
