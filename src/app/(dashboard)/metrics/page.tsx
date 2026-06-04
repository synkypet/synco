"use client";

import React, { useEffect, useState } from 'react';
import { TactileCard } from '@/components/ui/TactileCard';
import { KineticButton } from '@/components/ui/KineticButton';
import { RefreshCw, Plus, Settings, TrendingUp, Info, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { useRouter } from 'next/navigation';

export default function SyncoMetricsPage() {
  const router = useRouter();
  const [monitoredGroups, setMonitoredGroups] = useState<any[]>([]);
  const [availableGroups, setAvailableGroups] = useState<any[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [limit, setLimit] = useState(3);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [monitors, setMonitors] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedPeriod, setSelectedPeriod] = useState('last_7d');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showActivateGroup, setShowActivateGroup] = useState(false);
  const [selectedMonitor, setSelectedMonitor] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Form states for Create Monitor
  const [newMonitorGroupId, setNewMonitorGroupId] = useState('');
  const [newMonitorCampaignId, setNewMonitorCampaignId] = useState('');
  const [newMonitorName, setNewMonitorName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isActivatingGroup, setIsActivatingGroup] = useState(false);

  // UX Feedback and Dialog states
  const [feedbackToast, setFeedbackToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [groupToRemove, setGroupToRemove] = useState<{ monitorId: string, groupId: string, groupName: string } | null>(null);
  const [isRemovingGroup, setIsRemovingGroup] = useState(false);
  const [monitorToRemove, setMonitorToRemove] = useState<string | null>(null);
  const [isRemovingMonitor, setIsRemovingMonitor] = useState(false);

  const showFeedback = (message: string, type: 'success' | 'error') => {
    setFeedbackToast({ message, type });
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  const loadMetrics = async (isRefresh = false) => {
    try {
      if (isRefresh) setIsRefreshing(true);
      else setLoading(true);
      setError(null);

      const [summaryRes, campaignsRes, monitorsRes, groupsRes] = await Promise.all([
        fetch('/api/synco-metrics/summary'),
        fetch('/api/synco-metrics/meta/campaigns'),
        fetch(`/api/synco-metrics/monitors?period=${selectedPeriod}`),
        fetch('/api/synco-metrics/groups')
      ]);

      if (!summaryRes.ok || !monitorsRes.ok) {
        throw new Error('Erro ao carregar dados do SyncoMetrics');
      }

      const summaryData = await summaryRes.json();
      const monitorsData = await monitorsRes.json();
      const groupsData = await groupsRes.json();
      let campaignsData: any = { campaigns: [] };
      if (campaignsRes.ok) {
        campaignsData = await campaignsRes.json();
      }
      
      setMonitoredGroups(summaryData.monitoredGroups || []);
      setActiveCount(summaryData.activeCount || 0);
      setLimit(summaryData.limit || 3);
      setAvailableGroups(groupsData.groups?.filter((g: any) => !g.is_monitored) || []);
      setCampaigns(campaignsData.campaigns || []);
      setMonitors(monitorsData.monitors || []);
    } catch (err: any) {
      setError(err.message);
      if (isRefresh) alert("Não foi possível atualizar as métricas agora.");
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, [selectedPeriod]);

  // Handle UX Reset when closing create modal
  useEffect(() => {
    if (!isCreateModalOpen) {
      setShowActivateGroup(false);
    }
  }, [isCreateModalOpen]);

  const handleActivateGroup = async (group: any) => {
    if (activeCount >= limit) {
      alert(`Você já atingiu o limite máximo de ${limit} grupos monitorados.`);
      return;
    }
    setIsActivatingGroup(true);
    try {
      const response = await fetch('/api/synco-metrics/monitored-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: group.id, channel_id: group.channel_id })
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao ativar');
      }
      
      // Recarregar em background para não fechar modal
      await loadMetrics(true);
      setShowActivateGroup(false);
      setNewMonitorGroupId(group.id);
      showFeedback('Grupo ativado com sucesso!', 'success');
    } catch (err: any) {
      showFeedback(`Não foi possível ativar grupo: ${err.message}`, 'error');
    } finally {
      setIsActivatingGroup(false);
    }
  };

  const executeRemoveGroup = async () => {
    if (!groupToRemove) return;
    setIsRemovingGroup(true);
    try {
      const response = await fetch(`/api/synco-metrics/monitored-groups/${groupToRemove.monitorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false, is_deleted: true })
      });
      
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao remover grupo');
      }
      
      if (newMonitorGroupId === groupToRemove.groupId) {
        setNewMonitorGroupId('');
      }

      await loadMetrics(true);
      setGroupToRemove(null);
      showFeedback('Grupo deixou de ser monitorado.', 'success');
    } catch (err: any) {
      showFeedback(`Não foi possível parar de monitorar este grupo. ${err.message}`, 'error');
    } finally {
      setIsRemovingGroup(false);
    }
  };


  const handleCreateMonitor = async () => {
    if (!newMonitorGroupId || !newMonitorCampaignId) {
      showFeedback('Selecione o grupo e a campanha.', 'error');
      return;
    }
    
    setIsCreating(true);
    const cName = campaigns.find(c => c.id === newMonitorCampaignId)?.name || 'Campanha Desconhecida';
    
    try {
      const res = await fetch('/api/synco-metrics/monitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: newMonitorGroupId,
          campaignId: newMonitorCampaignId,
          campaignName: cName,
          monitorName: newMonitorName
        })
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Erro ao criar monitoramento');
      }

      setIsCreateModalOpen(false);
      setNewMonitorGroupId('');
      setNewMonitorCampaignId('');
      setNewMonitorName('');
      loadMetrics(true);
      showFeedback('Monitoramento criado com sucesso!', 'success');
    } catch (err: any) {
      showFeedback(`Erro ao criar monitoramento: ${err.message}`, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const executeDeleteMonitor = async () => {
    if (!monitorToRemove) return;
    setIsRemovingMonitor(true);
    try {
      const res = await fetch(`/api/synco-metrics/monitors/${monitorToRemove}`, {
        method: 'DELETE'
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Erro ao remover');
      }
      loadMetrics(true);
      if (selectedMonitor?.id === monitorToRemove) {
        setSelectedMonitor(null);
      }
      showFeedback('Monitoramento removido.', 'success');
      setMonitorToRemove(null);
    } catch (err: any) {
      showFeedback(`Não foi possível remover: ${err.message}`, 'error');
    } finally {
      setIsRemovingMonitor(false);
    }
  };

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '--';
    return `R$ ${val.toFixed(2).replace('.', ',')}`;
  };

  const formatNumber = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '--';
    return val;
  };

  const isLoading = loading || isRefreshing;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">SyncoMetrics</h1>
          <p className="text-zinc-400 mt-2 text-sm max-w-xl">
            Acompanhe o custo real por membro cruzando dados da Meta Ads com entradas reais no WhatsApp.
          </p>
        </div>
        
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-2">
            <select 
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm rounded-lg px-3 py-2 outline-none focus:border-kinetic-orange h-[38px]"
            >
              <option value="today">Hoje</option>
              <option value="last_7d">Últimos 7 dias</option>
              <option value="last_30d">Últimos 30 dias</option>
            </select>
            
            <KineticButton 
              onClick={() => loadMetrics(true)} 
              disabled={isLoading}
              className="flex items-center gap-2 bg-zinc-800 text-zinc-200 hover:text-white px-3 py-2 h-[38px]"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-kinetic-orange' : ''}`} />
            </KineticButton>

            <KineticButton 
              onClick={() => router.push('/configuracoes?tab=metrics')} 
              className="flex items-center gap-2 bg-zinc-800 text-zinc-200 hover:text-white px-3 py-2 h-[38px]"
              title="Configurar SyncoMetrics"
            >
              <Settings className="w-4 h-4" />
            </KineticButton>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-amber-900/20 border border-amber-900/50 text-amber-500 text-sm rounded-xl">
          {error}
        </div>
      )}

      {/* Seção Principal: Monitoramentos Ativos */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-zinc-200">Monitoramentos Ativos</h2>
          
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <KineticButton className="flex items-center gap-2 text-sm py-2 px-4">
                <Plus className="w-4 h-4" />
                Criar monitoramento
              </KineticButton>
            </DialogTrigger>
            <DialogContent className="bg-deep-void border-zinc-800 max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-zinc-100">Criar Monitoramento</DialogTitle>
                <DialogDescription className="sr-only">
                  Formulário para cruzar dados de uma Campanha da Meta com um Grupo de WhatsApp.
                </DialogDescription>
              </DialogHeader>
              <p className="text-xs text-zinc-400">
                Use isso para comparar uma campanha específica da Meta com o grupo que ela está tentando alimentar.
              </p>
              
              <div className="space-y-4 mt-4">
                <p className="text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20 leading-relaxed">
                  <strong className="block mb-1">Início a partir do zero</strong>
                  Os resultados deste monitoramento começarão do zero a partir de agora. Dados anteriores do grupo não serão misturados.
                </p>

                <div>
                  <label className="text-sm text-zinc-400 block mb-1">Grupo Monitorado</label>
                  <select 
                    value={newMonitorGroupId}
                    onChange={e => setNewMonitorGroupId(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg px-3 py-2 outline-none focus:border-kinetic-orange text-sm"
                  >
                    <option value="">Selecione um grupo ativo...</option>
                    {monitoredGroups.map(g => (
                      <option key={g.groupId} value={g.groupId}>{g.groupName}</option>
                    ))}
                  </select>
                  
                  {monitoredGroups.length === 0 && !showActivateGroup && (
                    <p className="text-xs text-amber-500 mt-2">
                      Você ainda não tem grupos monitorados. Ative um grupo primeiro para comparar com campanhas Meta.
                    </p>
                  )}

                  {monitoredGroups.length > 0 && (
                    <div className="mt-3 p-3 bg-zinc-950/50 border border-zinc-800/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-zinc-400 font-medium">Gerenciar grupos monitorados</span>
                        <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full">{activeCount} de {limit} usados</span>
                      </div>
                      <div className="space-y-2">
                        {monitoredGroups.map(g => (
                          <div key={g.groupId} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded p-2">
                            <span className="text-xs text-zinc-300 truncate pr-2" title={g.groupName}>{g.groupName}</span>
                            <button 
                              onClick={() => setGroupToRemove({ monitorId: g.monitorId, groupId: g.groupId, groupName: g.groupName })}
                              disabled={isRemovingGroup || isActivatingGroup}
                              className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors px-2 py-1"
                            >
                              Parar de monitorar
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!showActivateGroup ? (
                    <button 
                      onClick={() => setShowActivateGroup(true)}
                      className="text-xs text-kinetic-orange hover:text-white font-medium mt-2 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> {monitoredGroups.length === 0 ? 'Ativar grupo' : 'Ativar outro grupo'}
                    </button>
                  ) : (
                    <div className="mt-3 p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-zinc-300">Adicionar grupo ao SyncoMetrics</h4>
                        <button onClick={() => setShowActivateGroup(false)} className="text-zinc-500 hover:text-zinc-300 text-xs">✕</button>
                      </div>
                      
                      {activeCount >= limit ? (
                        <p className="text-xs text-amber-500 bg-amber-500/10 p-2 rounded">Limite de grupos monitorados atingido. Desative um grupo para adicionar outro.</p>
                      ) : availableGroups.length === 0 ? (
                        <p className="text-xs text-zinc-500">Não há novos grupos elegíveis para monitoramento.</p>
                      ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                          {availableGroups.map(group => (
                            <div key={group.id} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded p-2">
                              <span className="text-xs text-zinc-300 truncate pr-2" title={group.name}>{group.name}</span>
                              <KineticButton 
                                onClick={() => handleActivateGroup(group)}
                                disabled={isActivatingGroup}
                                className="text-[10px] py-1 px-3 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white h-auto"
                              >
                                {isActivatingGroup ? '...' : 'Ativar'}
                              </KineticButton>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm text-zinc-400 block mb-1">Campanha Meta Ads</label>
                  <select 
                    value={newMonitorCampaignId}
                    onChange={e => setNewMonitorCampaignId(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg px-3 py-2 outline-none focus:border-kinetic-orange text-sm"
                  >
                    <option value="">Selecione uma campanha...</option>
                    {campaigns.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm text-zinc-400 block mb-1">Nome do Monitoramento (Opcional)</label>
                  <input 
                    type="text"
                    placeholder="Ex: MW Geral → Miúdos Web #1"
                    value={newMonitorName}
                    onChange={e => setNewMonitorName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg px-3 py-2 outline-none focus:border-kinetic-orange text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button onClick={() => setIsCreateModalOpen(false)} className="text-zinc-400 text-sm px-4 py-2 hover:text-zinc-200">
                    Cancelar
                  </button>
                  <KineticButton onClick={handleCreateMonitor} disabled={isCreating || !newMonitorGroupId || !newMonitorCampaignId} className="px-6">
                    {isCreating ? 'Criando...' : 'Criar'}
                  </KineticButton>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading && monitors.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="h-40 bg-zinc-900/50 rounded-xl border border-zinc-800 animate-pulse"></div>
            <div className="h-40 bg-zinc-900/50 rounded-xl border border-zinc-800 animate-pulse"></div>
          </div>
        ) : monitors.length === 0 ? (
          <TactileCard className="p-12 text-center border-dashed border-zinc-800">
            <TrendingUp className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-400 font-medium">Nenhum monitoramento ativo.</p>
            <p className="text-zinc-500 text-sm mt-1 max-w-md mx-auto">
              Crie seu primeiro monitoramento para cruzar o desempenho de uma campanha com o crescimento de um grupo específico.
            </p>
          </TactileCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {monitors.map(monitor => (
              <TactileCard key={monitor.id} className="p-5 ring-1 ring-zinc-800/50 hover:ring-kinetic-orange/30 transition-all flex flex-col justify-between group">
                <div>
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <h3 className="font-bold text-zinc-200 text-sm line-clamp-2" title={monitor.monitorName}>{monitor.monitorName}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-2 mt-4 text-xs">
                    <div className="bg-zinc-950/50 p-2 rounded border border-zinc-800/50">
                      <span className="block text-zinc-500 mb-1">Gasto Meta</span>
                      <span className="font-semibold text-zinc-300">{formatCurrency(monitor.meta.spend)}</span>
                    </div>
                    <div className="bg-zinc-950/50 p-2 rounded border border-zinc-800/50">
                      <span className="block text-zinc-500 mb-1">Leads Meta</span>
                      <span className="font-semibold text-zinc-300">{formatNumber(monitor.meta.leads)}</span>
                    </div>
                    <div className="bg-zinc-950/50 p-2 rounded border border-kinetic-orange/20">
                      <span className="block text-zinc-500 mb-1">Crescimento Líquido</span>
                      <span className={`font-semibold ${monitor.group.netGrowth > 0 ? 'text-emerald-400' : 'text-zinc-300'}`}>
                        {monitor.group.netGrowth > 0 ? `+${monitor.group.netGrowth}` : monitor.group.netGrowth}
                      </span>
                    </div>
                    <div className="bg-zinc-950/50 p-2 rounded border border-kinetic-orange/20">
                      <span className="block text-zinc-500 mb-1">Custo por Membro Líq.</span>
                      <span className="font-semibold text-zinc-300">{formatCurrency(monitor.comparison.realCostPerMember)}</span>
                    </div>
                  </div>
                </div>
                
                {monitor.meta.error && (
                  <p className="text-[10px] text-amber-500 mt-3">{monitor.meta.error}</p>
                )}

                <div className="mt-4 pt-3 border-t border-zinc-800/50 flex items-center justify-between">
                  <button 
                    onClick={() => setMonitorToRemove(monitor.id)}
                    className="text-zinc-600 hover:text-red-400 transition-colors p-1"
                    title="Remover monitoramento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={async () => {
                      setSelectedMonitor(monitor);
                      setDetailsLoading(true);
                      try {
                        const res = await fetch(`/api/synco-metrics/monitors/${monitor.id}/details?period=${selectedPeriod}`);
                        if (!res.ok) throw new Error('Erro ao buscar detalhes');
                        const data = await res.json();
                        setSelectedMonitor(data);
                      } catch (e: any) {
                        showFeedback(e.message, 'error');
                      } finally {
                        setDetailsLoading(false);
                      }
                    }}
                    className="text-[11px] font-semibold text-kinetic-orange hover:text-white transition-colors flex items-center gap-1 uppercase tracking-wide"
                  >
                    <Info className="w-3 h-3" /> Ver detalhes
                  </button>
                </div>
              </TactileCard>
            ))}
          </div>
        )}
      </div>

      {/* Modal Detalhes */}
      <Dialog open={!!selectedMonitor} onOpenChange={(open) => !open && setSelectedMonitor(null)}>
        <DialogContent className="bg-deep-void border-zinc-800 max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedMonitor && (
            <>
              <DialogHeader>
                <DialogTitle className="text-zinc-100 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-kinetic-orange" />
                  Detalhes do Monitoramento
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Exibe informações detalhadas do crescimento do grupo comparado à campanha da Meta.
                </DialogDescription>
                <div className="space-y-1 mt-2">
                  <p className="text-sm font-medium text-zinc-300">
                    {selectedMonitor.monitorName || selectedMonitor.monitor?.name}
                  </p>
                  
                  {selectedMonitor.monitor?.baselineAt ? (
                    <p className="text-xs text-zinc-400 bg-zinc-900 p-2 rounded border border-zinc-800 mt-2">
                      Este monitoramento iniciou em <span className="text-zinc-200">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(selectedMonitor.monitor.baselineAt))}</span>. 
                      Os resultados consideram apenas movimentos detectados após esse início.{' '}
                      {selectedMonitor.monitor.baselineMemberCount !== null 
                        ? `Grupo tinha ${selectedMonitor.monitor.baselineMemberCount} membros no início.` 
                        : 'Aguardando primeira coleta para definir o ponto inicial.'}
                    </p>
                  ) : (
                    <p className="text-[10px] text-zinc-500">Carregando baseline...</p>
                  )}
                </div>
              </DialogHeader>

              <div className="mt-4 space-y-6">
                
                {/* Comparação */}
                <TactileCard className="p-4 border-kinetic-orange/30 bg-kinetic-orange/5 flex justify-between items-center">
                  <div>
                    <span className="text-xs text-kinetic-orange block mb-1 uppercase font-semibold">Custo Real por Membro</span>
                    <span className="text-2xl font-bold text-zinc-100">{formatCurrency(selectedMonitor.comparison.realCostPerMember)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-zinc-500 block mb-1">Diferença Meta x Real</span>
                    <span className="text-lg font-semibold text-zinc-300">{formatNumber(selectedMonitor.comparison.difference)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-zinc-500 block mb-1">Taxa Lead → Membro</span>
                    <span className="text-lg font-semibold text-emerald-400">{formatNumber(selectedMonitor.comparison.leadToMemberRate)}%</span>
                  </div>
                </TactileCard>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bloco Meta */}
                  <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
                    <h4 className="text-sm font-semibold text-zinc-200 mb-3 border-b border-zinc-800 pb-2">Desempenho Meta Ads</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-zinc-500">Campanha</span><span className="text-zinc-300 truncate max-w-[150px] text-right" title={selectedMonitor.campaignName}>{selectedMonitor.campaignName}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Gasto Total</span><span className="text-zinc-300">{formatCurrency(selectedMonitor.meta.spend)}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Leads Informados</span><span className="text-zinc-300">{formatNumber(selectedMonitor.meta.leads)}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Custo por Lead</span><span className="text-zinc-300">{formatCurrency(selectedMonitor.meta.costPerLead)}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Cliques</span><span className="text-zinc-300">{formatNumber(selectedMonitor.meta.clicks)}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Impressões</span><span className="text-zinc-300">{formatNumber(selectedMonitor.meta.impressions)}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">CTR</span><span className="text-zinc-300">{formatNumber(selectedMonitor.meta.ctr)}%</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">CPC</span><span className="text-zinc-300">{formatCurrency(selectedMonitor.meta.cpc)}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">CPM</span><span className="text-zinc-300">{formatCurrency(selectedMonitor.meta.cpm)}</span></div>
                    </div>
                  </div>

                  {/* Bloco Grupo */}
                  <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
                    <h4 className="text-sm font-semibold text-zinc-200 mb-3 border-b border-zinc-800 pb-2">Crescimento Grupo</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-zinc-500">Grupo</span><span className="text-zinc-300 truncate max-w-[150px] text-right" title={selectedMonitor.groupName}>{selectedMonitor.groupName}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Membros Atuais</span><span className="text-zinc-300">{formatNumber(selectedMonitor.group.currentMembers)}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Entradas Líquidas Estimadas</span><span className="text-emerald-400 font-medium">{selectedMonitor.group.estimatedJoined > 0 ? `+${selectedMonitor.group.estimatedJoined}` : selectedMonitor.group.estimatedJoined}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Saídas Líquidas Estimadas</span><span className="text-red-400">-{selectedMonitor.group.estimatedLeft}</span></div>
                      <div className="flex justify-between pt-2 mt-2 border-t border-zinc-800"><span className="text-zinc-500">Saldo do Período</span><span className="font-semibold text-zinc-200">{formatNumber(selectedMonitor.group.netGrowth)}</span></div>
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-4 text-center">
                      Os valores representam a variação líquida de membros entre coletas. Se entradas e saídas ocorrerem simultaneamente no mesmo intervalo, apenas o saldo final é detectado.
                    </p>
                  </div>
                </div>

                {/* Eventos Meta / Pixel */}
                <div className="mt-6 pt-6 border-t border-zinc-800">
                  <h4 className="text-sm font-semibold text-zinc-200 mb-2">Eventos Meta / Pixel</h4>
                  <p className="text-[10px] text-zinc-500 mb-4 bg-zinc-900/50 p-2 rounded border border-zinc-800">
                    Eventos da Meta podem representar ações diferentes e podem ter duplicidade entre categorias. Use Leads informados pela Meta como métrica principal de comparação.
                  </p>
                  {selectedMonitor.meta.events && selectedMonitor.meta.events.length > 0 ? (
                    <div className="space-y-3">
                      {selectedMonitor.meta.events.map((ev: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-zinc-200">{ev.actionType}</span>
                              {ev.isLeadCandidate && (
                                <span className="text-[9px] bg-kinetic-orange/20 text-kinetic-orange px-1.5 py-0.5 rounded uppercase font-semibold">Usado como Lead</span>
                              )}
                            </div>
                            {ev.cost && (
                              <span className="text-xs text-zinc-500 mt-0.5 block">Custo médio: {formatCurrency(ev.cost)}</span>
                            )}
                          </div>
                          <span className="font-semibold text-zinc-300 bg-zinc-950 px-2.5 py-1 rounded border border-zinc-800">
                            {formatNumber(ev.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500 bg-zinc-900/30 p-3 rounded-lg border border-zinc-800/50 text-center">
                      Nenhum evento Meta/Pixels retornado para este período.
                    </p>
                  )}
                </div>

                {/* Linha do Tempo */}
                <div className="mt-6 pt-6 border-t border-zinc-800">
                  <h4 className="text-sm font-semibold text-zinc-200 mb-4">Linha do Tempo de Crescimento</h4>
                  {detailsLoading ? (
                    <div className="text-sm text-zinc-500">Carregando histórico...</div>
                  ) : selectedMonitor.timeline?.length > 0 ? (
                    <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                      <div className="bg-kinetic-orange/10 p-3 rounded-lg border border-kinetic-orange/20 mb-4">
                        <p className="text-[10px] text-kinetic-orange">
                          Os valores representam a variação líquida de membros entre coletas. Se entradas e saídas ocorrerem simultaneamente no mesmo intervalo, apenas o saldo final é detectado.
                        </p>
                      </div>
                      {Object.entries(
                        selectedMonitor.timeline.reduce((acc: any, t: any) => {
                          const d = new Date(t.to);
                          const key = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(d);
                          if (!acc[key]) acc[key] = [];
                          acc[key].push(t);
                          return acc;
                        }, {})
                      ).map(([date, events]: any) => (
                        <div key={date}>
                          <h5 className="text-xs font-semibold text-zinc-400 mb-2">{date}</h5>
                          <div className="space-y-2">
                            {events.map((ev: any, idx: number) => {
                              const timeFrom = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(ev.from));
                              const timeTo = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(ev.to));
                              
                              const isEntry = ev.estimatedJoined > 0;
                              const isExit = ev.estimatedLeft > 0;
                              const isMixed = isEntry && isExit;
                              
                              let desc = '';
                              if (isMixed) desc = `saldo +${ev.estimatedJoined} / saldo -${ev.estimatedLeft}`;
                              else if (isEntry) desc = `saldo +${ev.estimatedJoined} membro(s)`;
                              else if (isExit) desc = `saldo -${ev.estimatedLeft} membro(s)`;

                              return (
                                <div key={idx} className="flex items-center gap-3 text-xs bg-zinc-900/50 p-2 rounded border border-zinc-800">
                                  <span className="text-zinc-500 w-24 shrink-0">Entre {timeFrom} e {timeTo}</span>
                                  <span className={`font-medium ${isEntry ? 'text-emerald-400' : 'text-red-400'} w-36 shrink-0`}>
                                    {desc}
                                  </span>
                                  <span className="text-zinc-400">
                                    {ev.previousCount} → {ev.currentCount} membros
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500 bg-zinc-900/30 p-3 rounded-lg border border-zinc-800/50 text-center">
                      Nenhuma entrada ou saída detectada neste período.
                    </p>
                  )}
                </div>

                <div className="flex justify-end pt-4">
                  <KineticButton onClick={() => setSelectedMonitor(null)} className="px-6">Fechar</KineticButton>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Toast de Feedback */}
      {feedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
          <TactileCard className={`p-4 flex items-center gap-3 border ${
            feedbackToast.type === 'error' ? 'border-amber-500/50 bg-amber-500/10 text-amber-500' : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
          }`}>
            <span className="text-sm font-medium">{feedbackToast.message}</span>
            <button onClick={() => setFeedbackToast(null)} className="text-zinc-500 hover:text-zinc-300 ml-2">✕</button>
          </TactileCard>
        </div>
      )}

      {/* Modal de Remoção de Grupo */}
      <Dialog open={!!groupToRemove} onOpenChange={(open) => !open && setGroupToRemove(null)}>
        <DialogContent className="bg-deep-void border-zinc-800 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Parar de monitorar grupo?</DialogTitle>
            <DialogDescription className="sr-only">
              Confirmação para interromper o monitoramento ativo de um grupo do WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-zinc-400 mt-2">
            Este grupo deixará de ter coletas de membros. Monitoramentos ligados a ele podem parar de comparar entradas reais.
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setGroupToRemove(null)} className="text-zinc-400 text-sm px-4 py-2 hover:text-zinc-200" disabled={isRemovingGroup}>
              Cancelar
            </button>
            <KineticButton onClick={executeRemoveGroup} disabled={isRemovingGroup} className="px-6 bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 hover:text-red-300">
              {isRemovingGroup ? 'Parando...' : 'Parar de monitorar'}
            </KineticButton>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Remoção de Monitoramento */}
      <Dialog open={!!monitorToRemove} onOpenChange={(open) => !open && setMonitorToRemove(null)}>
        <DialogContent className="bg-deep-void border-zinc-800 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Remover monitoramento?</DialogTitle>
            <DialogDescription className="sr-only">
              Confirmação para remover o vínculo entre a campanha e o grupo.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-zinc-400 mt-2">
            Este vínculo entre campanha e grupo será removido. Os dados da Meta e o histórico do grupo não serão apagados. Se você criar novamente, o monitoramento começará do zero.
          </p>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setMonitorToRemove(null)} className="text-zinc-400 text-sm px-4 py-2 hover:text-zinc-200" disabled={isRemovingMonitor}>
              Cancelar
            </button>
            <KineticButton onClick={executeDeleteMonitor} disabled={isRemovingMonitor} className="px-6 bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 hover:text-red-300">
              {isRemovingMonitor ? 'Removendo...' : 'Remover'}
            </KineticButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
