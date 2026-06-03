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

  // Form states for Create Monitor
  const [newMonitorGroupId, setNewMonitorGroupId] = useState('');
  const [newMonitorCampaignId, setNewMonitorCampaignId] = useState('');
  const [newMonitorName, setNewMonitorName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isActivatingGroup, setIsActivatingGroup] = useState(false);

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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao ativar');
      }
      
      // Recarregar em background para não fechar modal
      await loadMetrics(true);
      setShowActivateGroup(false);
      setNewMonitorGroupId(group.id);
      alert('Grupo ativado com sucesso!');
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setIsActivatingGroup(false);
    }
  };

  const handleRemoveGroup = async (monitorId: string, groupId: string) => {
    if (!confirm('Parar de monitorar este grupo? Os monitoramentos ligados a ele podem deixar de comparar entradas reais.')) {
      return;
    }
    setIsActivatingGroup(true);
    try {
      const response = await fetch(`/api/synco-metrics/monitored-groups/${monitorId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao remover grupo');
      }
      
      if (newMonitorGroupId === groupId) {
        setNewMonitorGroupId('');
      }

      await loadMetrics(true);
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setIsActivatingGroup(false);
    }
  };


  const handleCreateMonitor = async () => {
    if (!newMonitorGroupId || !newMonitorCampaignId) {
      alert('Selecione o grupo e a campanha.');
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao criar monitoramento');
      }

      setIsCreateModalOpen(false);
      setNewMonitorGroupId('');
      setNewMonitorCampaignId('');
      setNewMonitorName('');
      loadMetrics(true);
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteMonitor = async (id: string) => {
    if (!confirm('Deseja realmente remover este monitoramento?')) return;
    try {
      const res = await fetch(`/api/synco-metrics/monitors/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao remover');
      }
      loadMetrics(true);
      if (selectedMonitor?.id === id) {
        setSelectedMonitor(null);
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
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
              </DialogHeader>
              <p className="text-xs text-zinc-400">
                Use isso para comparar uma campanha específica da Meta com o grupo que ela está tentando alimentar.
              </p>
              
              <div className="space-y-4 mt-4">
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
                              onClick={() => handleRemoveGroup(g.monitorId, g.groupId)}
                              disabled={isActivatingGroup}
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
                      <span className="block text-zinc-500 mb-1">Entradas Reais</span>
                      <span className={`font-semibold ${monitor.group.estimatedJoined > 0 ? 'text-emerald-400' : 'text-zinc-300'}`}>
                        {monitor.group.estimatedJoined > 0 ? `+${monitor.group.estimatedJoined}` : monitor.group.estimatedJoined}
                      </span>
                    </div>
                    <div className="bg-zinc-950/50 p-2 rounded border border-kinetic-orange/20">
                      <span className="block text-zinc-500 mb-1">Custo/Membro</span>
                      <span className="font-semibold text-zinc-300">{formatCurrency(monitor.comparison.realCostPerMember)}</span>
                    </div>
                  </div>
                </div>
                
                {monitor.meta.error && (
                  <p className="text-[10px] text-amber-500 mt-3">{monitor.meta.error}</p>
                )}

                <div className="mt-4 pt-3 border-t border-zinc-800/50 flex items-center justify-between">
                  <button 
                    onClick={() => handleDeleteMonitor(monitor.id)}
                    className="text-zinc-600 hover:text-red-400 transition-colors p-1"
                    title="Remover monitoramento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setSelectedMonitor(monitor)}
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
                <p className="text-sm text-zinc-400">{selectedMonitor.monitorName}</p>
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
                      <div className="flex justify-between"><span className="text-zinc-500">Entradas Estimadas</span><span className="text-emerald-400 font-medium">{selectedMonitor.group.estimatedJoined > 0 ? `+${selectedMonitor.group.estimatedJoined}` : selectedMonitor.group.estimatedJoined}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Saídas Estimadas</span><span className="text-red-400">-{selectedMonitor.group.estimatedLeft}</span></div>
                      <div className="flex justify-between pt-2 mt-2 border-t border-zinc-800"><span className="text-zinc-500">Crescimento Líquido</span><span className="font-semibold text-zinc-200">{formatNumber(selectedMonitor.group.netGrowth)}</span></div>
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-4 text-center">Entradas e saídas são estimativas baseadas na variação capturada pelos snapshots regulares.</p>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <KineticButton onClick={() => setSelectedMonitor(null)} className="px-6">Fechar</KineticButton>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
