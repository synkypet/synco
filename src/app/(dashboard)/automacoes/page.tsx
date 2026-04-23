// src/app/(dashboard)/automacoes/page.tsx
'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  useAutomationSources,
  useCreateAutomationPipeline
} from '@/hooks/use-automations';
import { useChannels } from '@/hooks/use-channels';
import { useGroups } from '@/hooks/use-groups';
import { useDestinations } from '@/hooks/use-destinations';
import { useQueryClient } from '@tanstack/react-query';
import { TactileCard } from '@/components/ui/TactileCard';
import { StatCard } from '@/components/ui/StatCard';
import { AutomationTargetSelector } from '@/components/automation/AutomationTargetSelector';
import { AutomationSource, AutomationRoute } from '@/types/automation';
import { Button } from '@/components/ui/button';
import { KineticButton } from '@/components/ui/KineticButton';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/shared/PageHeader';
import LayoutContainer from '@/components/layout/LayoutContainer';
import { 
  MoreVertical,
  MessageCircle,
  PlusCircle,
  Loader2,
  Radio,
  Target,
  ChevronRight,
  ShieldAlert,
  Inbox,
  Zap,
  Activity,
  Settings,
  ShieldCheck,
  FileText,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { OperationalAccessBanner } from '@/components/billing/OperationalAccessBanner';

export default function AutomacoesDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // Queries
  const { data: sources, isLoading } = useAutomationSources(user?.id as string);
  const { data: channels } = useChannels(user?.id);
  const { data: allGroups } = useGroups(user?.id as string);
  const { data: allLists } = useDestinations(user?.id as string);
  
  // Mutations
  const createPipeline = useCreateAutomationPipeline();

  // New Creation State
  const [isNewMonitorOpen, setIsNewMonitorOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [entryType, setEntryType] = useState<'group_monitor' | 'radar_offers'>('group_monitor');
  const [channelId, setChannelId] = useState('');
  const [sourceGroupId, setSourceGroupId] = useState('');
  const [targetType, setTargetType] = useState<'group' | 'list'>('group');
  const [targetId, setTargetId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minCommission, setMinCommission] = useState('');
  const [shopeeSort, setShopeeSort] = useState('1'); 
  const [shopeeList, setShopeeList] = useState('0');
  const [shopeeLimit, setShopeeLimit] = useState('10');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewResults, setPreviewResults] = useState<any[] | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Validação simples
  const isNameValid = newName.trim().length >= 3;
  const isEntryValid = entryType === 'radar_offers' || (channelId && sourceGroupId);
  const isTargetValid = !!targetId;
  const isSearchTermValid = entryType === 'radar_offers' ? searchTerm.trim().length >= 2 : true;
  const isFormValid = isNameValid && isEntryValid && isTargetValid && isSearchTermValid;

  const handleCreatePipeline = () => {
    if (!isFormValid) return;

    const selectedSourceGroup = allGroups?.find(g => g.id === sourceGroupId);

    const promise = createPipeline.mutateAsync({
      userId: user?.id as string,
      name: newName,
      source_type: entryType,
      channel_id: channelId || undefined,
      external_group_id: selectedSourceGroup?.remote_id || undefined,
      target_type: targetType,
      target_id: targetId,
      config: entryType === 'radar_offers' ? { 
        searchTerm: searchTerm.trim(),
        sortType: parseInt(shopeeSort),
        listType: parseInt(shopeeList),
        batchLimit: parseInt(shopeeLimit)
      } : undefined,
      // Passando filtros para a rota inicial
      filters: entryType === 'radar_offers' ? {
        min_price: minPrice ? parseFloat(minPrice) : undefined,
        max_price: maxPrice ? parseFloat(maxPrice) : undefined,
        min_commission_value: minCommission ? parseFloat(minCommission) : undefined
      } : undefined
    } as any); // Adicionando any para evitar erro de tipo se filters não estiver no DTO básico

    toast.promise(promise, {
      loading: 'Iniciando esteira operacional...',
      success: (data: any) => {
        setIsNewMonitorOpen(false);
        router.push(`/automacoes/${data.id}`);
        return 'Automação criada com sucesso!';
      },
      error: (err: any) => `Erro na criação: ${err.message || 'Verifique os dados.'}`
    });
  };

  const handlePreviewRadar = async () => {
    if (!searchTerm.trim()) return;
    setIsPreviewing(true);
    setPreviewResults(null);
    try {
      const res = await fetch('/api/radar/fetch-shopee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: searchTerm.trim(),
          sortType: parseInt(shopeeSort),
          listType: parseInt(shopeeList),
          limit: 10,
          minPrice: minPrice ? parseFloat(minPrice) : undefined,
          maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
          minCommission: minCommission ? parseFloat(minCommission) : undefined
        })
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setPreviewResults(data.products || data.similar_products || []);
      } else {
        toast.error('Erro no preview: ' + data.error);
      }
    } catch (err) {
      toast.error('Falha ao gerar preview.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSync = async (sourceId: string) => {
    setSyncingId(sourceId);
    try {
      const response = await fetch('/api/radar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId })
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        // Invalida os logs para atualizar a tabela instantaneamente
        queryClient.invalidateQueries({ queryKey: ['automation-logs'] });
        
        if (data.totalInserted > 0) {
          toast.success(`Sucesso! ${data.totalInserted} novas ofertas exclusivas injetadas no seu Radar.`);
        } else {
          toast.info('Sincronismo finalizado: Nenhuma oferta nova encontrada (Deduplicadas).');
        }
      } else {
        toast.error('Erro na sincronização: ' + data.error);
      }
    } catch (err) {
      toast.error('Falha na comunicação com o servidor.');
    } finally {
      setSyncingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="animate-spin text-kinetic-orange" size={40} />
        <p className="text-muted-foreground animate-pulse font-bold uppercase tracking-widest text-[10px]">Sincronizando Painel de Automação...</p>
      </div>
    );
  }

  return (
    <LayoutContainer type="operational">
      {/* Header */}
      <PageHeader 
        title="Automações"
        description="Controle de fluxo automático: Captação ➔ Regras ➔ Envio."
        icon={<Zap size={24} />}
        actions={
          <Dialog open={isNewMonitorOpen} onOpenChange={setIsNewMonitorOpen}>
            <DialogTrigger asChild>
              <KineticButton className="gap-2 h-12 px-6 rounded-2xl">
                <PlusCircle size={18} /> Nova Automação
              </KineticButton>
            </DialogTrigger>
            <DialogContent className="max-w-xl p-0 overflow-y-auto max-h-[90vh]">
              <div className="p-6 bg-gradient-to-b from-white/5 to-transparent">
                 <DialogHeader>
                   <DialogTitle className="mb-4 flex items-center gap-2">
                      <Zap size={14} className="animate-pulse text-kinetic-orange" />
                      Iniciar Esteira de Pipeline
                   </DialogTitle>
                 </DialogHeader>
                 
                 <div className="space-y-6 pt-2">
                    {/* 1. Nome */}
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-black text-white/30 tracking-widest flex justify-between">
                         Nome da Esteira
                         {!isNameValid && newName.length > 0 && <span className="text-red-400 font-bold tracking-tight">Mín. 3 caracteres</span>}
                      </Label>
                      <Input 
                        placeholder="Ex: Ofertas VIP - Eletrônicos" 
                        className={!isNameValid && newName.length > 0 ? 'ring-1 ring-red-500/50' : ''}
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                    </div>
  
                    {/* 2. Entrada */}
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-black text-white/30 tracking-widest">Origem de Dados (Source)</Label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEntryType('group_monitor')}
                          className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                            entryType === 'group_monitor' 
                              ? 'bg-kinetic-orange/10 border-kinetic-orange/40 text-kinetic-orange shadow-glow-orange' 
                              : 'bg-white/5 border-white/10 text-white/20 hover:bg-white/10'
                          }`}
                        >
                          <Radio size={20} className="mb-2" />
                          <span className="text-[9px] font-black uppercase tracking-widest">Monitorar Grupo</span>
                        </button>
                        <button
                          onClick={() => setEntryType('radar_offers')}
                          className={`flex-1 flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                            entryType === 'radar_offers' 
                              ? 'bg-kinetic-orange/10 border-kinetic-orange/40 text-kinetic-orange shadow-glow-orange' 
                              : 'bg-white/5 border-white/10 text-white/20 hover:bg-white/10'
                          }`}
                        >
                          <Inbox size={20} className="mb-2" />
                          <span className="text-[9px] font-black uppercase tracking-widest">Radar Pro</span>
                        </button>
                      </div>
                    </div>
  
                    {entryType === 'radar_offers' && (
                      <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-black text-white/30 tracking-widest flex justify-between">
                             Termo de Busca (Keyword)
                             {!isSearchTermValid && searchTerm.length > 0 && <span className="text-red-400 font-bold tracking-tight">Mín. 2 caracteres</span>}
                          </Label>
                          <Input 
                            placeholder="Ex: fone bluetooth, air fryer..." 
                            className={!isSearchTermValid && searchTerm.length > 0 ? 'ring-1 ring-red-500/50' : ''}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                             <Label className="text-[10px] uppercase font-black text-white/30 tracking-widest">Ordenar (Shopee)</Label>
                             <Select value={shopeeSort} onValueChange={setShopeeSort}>
                               <SelectTrigger>
                                 <SelectValue />
                               </SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="1">Específico</SelectItem>
                                 <SelectItem value="2">Mais Recentes</SelectItem>
                                 <SelectItem value="5">Maior Comissão</SelectItem>
                               </SelectContent>
                             </Select>
                           </div>
                           <div className="space-y-2">
                             <Label className="text-[10px] uppercase font-black text-white/30 tracking-widest">Lista</Label>
                             <Select value={shopeeList} onValueChange={setShopeeList}>
                               <SelectTrigger>
                                 <SelectValue />
                               </SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="0">Padrão</SelectItem>
                                 <SelectItem value="1">Em Promoção</SelectItem>
                               </SelectContent>
                             </Select>
                           </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                           <div className="space-y-2">
                             <Label className="text-[10px] uppercase font-black text-white/30 tracking-widest">Preço Mín</Label>
                             <Input type="number" placeholder="0.00" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
                           </div>
                           <div className="space-y-2">
                             <Label className="text-[10px] uppercase font-black text-white/30 tracking-widest">Comissão Mín (R$)</Label>
                             <Input type="number" placeholder="0.00" value={minCommission} onChange={(e) => setMinCommission(e.target.value)} />
                           </div>
                           <div className="space-y-2">
                             <Label className="text-[10px] uppercase font-black text-white/30 tracking-widest">Qtd/Ciclo</Label>
                             <Select value={shopeeLimit} onValueChange={setShopeeLimit}>
                               <SelectTrigger>
                                 <SelectValue />
                               </SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="3">3 itens</SelectItem>
                                 <SelectItem value="5">5 itens</SelectItem>
                                 <SelectItem value="10">10 itens</SelectItem>
                                 <SelectItem value="20">20 itens</SelectItem>
                               </SelectContent>
                             </Select>
                           </div>
                        </div>

                        <Button 
                          variant="secondary" 
                          className="w-full h-10 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest gap-2"
                          onClick={handlePreviewRadar}
                          disabled={isPreviewing || !isSearchTermValid}
                        >
                          {isPreviewing ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
                          Gerar Preview das Ofertas
                        </Button>

                        {previewResults && (
                          <div className="space-y-2 p-4 bg-black/20 rounded-2xl border border-white/5 animate-in fade-in duration-500">
                             <p className="text-[9px] font-black uppercase text-white/20 tracking-widest mb-3">Preview da Curadoria ({previewResults.length} itens)</p>
                             <div className="space-y-2 max-h-[220px] overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar">
                                {previewResults.length === 0 ? (
                                  <p className="text-[10px] text-white/30 italic text-center py-4">Nenhum produto encontrado com estes filtros.</p>
                                ) : (
                                  previewResults.map((p, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg border border-white/[0.02] overflow-hidden">
                                       <img src={p.image_url} className="w-10 h-10 rounded bg-white/10 object-cover shrink-0" />
                                       <div className="flex-1 min-w-0">
                                          <p className="text-[10px] font-bold text-white/80 line-clamp-2 leading-tight mb-1">{p.name}</p>
                                          <p className="text-[8px] font-medium text-white/30 truncate">R$ {p.current_price} • Comis: R$ {p.commission_value}</p>
                                       </div>
                                    </div>
                                  ))
                                )}
                             </div>
                          </div>
                        )}
                      </div>
                    )}

                    {entryType === 'group_monitor' && (
                      <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-bottom-2 duration-300">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-black text-white/30 tracking-widest">Canal</Label>
                          <Select value={channelId} onValueChange={(val) => { setChannelId(val); setSourceGroupId(''); }}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {channels?.filter(c => c.type === 'whatsapp').map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
  
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase font-black text-white/30 tracking-widest">Grupo Alvo</Label>
                          <Select value={sourceGroupId} onValueChange={setSourceGroupId} disabled={!channelId}>
                            <SelectTrigger disabled={!channelId}>
                              <SelectValue placeholder={!channelId ? "Aguardando..." : "Escolha..."} />
                            </SelectTrigger>
                            <SelectContent>
                              {allGroups?.filter(g => g.channel_id === channelId).map(g => (
                                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
  
                    {/* 3. Destino */}
                    <AutomationTargetSelector 
                      groups={allGroups}
                      lists={allLists}
                      type={targetType}
                      value={targetId}
                      onTypeChange={setTargetType}
                      onValueChange={setTargetId}
                    />
                 </div>
  
                 <div className="mt-8 mb-6 p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
                   <AlertCircle size={16} className="text-zinc-500 shrink-0" />
                   <p className="text-[9px] uppercase font-bold tracking-widest text-zinc-500 leading-relaxed italic">
                     Regras de curadoria (preço, comissão, filtros) e templates serão configurados na próxima etapa.
                   </p>
                 </div>
  
                 <DialogFooter className="bg-black/20 p-6">
                  <KineticButton 
                    className={`w-full h-14 rounded-2xl ${
                      !isFormValid ? 'grayscale opacity-50 cursor-not-allowed' : ''
                    }`}
                    onClick={handleCreatePipeline}
                    disabled={!isFormValid || createPipeline.isPending}
                  >
                    {createPipeline.isPending ? <Loader2 className="animate-spin" /> : 'Criar e Abrir Pipeline'}
                  </KineticButton>
                 </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <OperationalAccessBanner />

      {/* Stats View */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <StatCard 
          label="Monitores Ativos"
          value={sources?.filter(s => s.is_active).length || 0}
          icon={<Activity size={12} />}
          colorScheme="success"
        />
        <StatCard 
          label="Automações no Total"
          value={sources?.length || 0}
          icon={<Zap size={12} />}
          colorScheme="kinetic"
        />
      </div>

      {/* Sources Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
        {sources && sources.length > 0 ? (
          sources.map(source => {
            const firstRoute = source.automation_routes?.[0];
            const targetName = firstRoute?.target_type === 'group' 
              ? allGroups?.find(g => g.id === firstRoute.target_id)?.name
              : allLists?.find(l => l.id === firstRoute?.target_id)?.name;
            const hasTemplate = !!firstRoute?.template_config?.body;

            return (
              <TactileCard key={source.id} className="group overflow-hidden border-white/5 hover:border-kinetic-orange/20 transition-all duration-500">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 shadow-skeuo-flat">
                         <Zap size={20} className={source.is_active ? "text-kinetic-orange" : "text-white/20"} />
                      </div>
                      <div>
                        <h3 className="font-black text-white/90 uppercase tracking-tight italic text-lg">{source.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                           <Badge variant="outline" className="text-[8px] font-black uppercase border-white/10 text-white/40 h-4">
                             {source.source_type === 'group_monitor' ? 'Monitoramento' : 'Radar'}
                           </Badge>
                        </div>
                      </div>
                    </div>
                    <Badge variant={source.is_active ? "default" : "secondary"} className={source.is_active ? "bg-emerald-500 shadow-glow-orange-intense text-white border-none font-bold text-[9px] rounded-full" : "font-bold text-[9px] rounded-full"}>
                      {source.is_active ? 'ATIVO' : 'PAUSADO'}
                    </Badge>
                  </div>

                  {/* Flow Trace */}
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/[0.02] shadow-skeuo-pressed space-y-4">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                           <Radio size={12} className="text-white/40" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                           <p className="text-[9px] font-black uppercase text-white/20 tracking-widest">Entrada (Source)</p>
                           <p className="text-xs font-bold text-white/60 truncate italic">{source.external_group_id || 'Radar de Ofertas'}</p>
                        </div>
                        <ChevronRight size={14} className="text-white/10" />
                        <div className="w-8 h-8 rounded-full bg-kinetic-orange/10 flex items-center justify-center shrink-0 border border-kinetic-orange/20">
                           <Target size={12} className="text-kinetic-orange" />
                        </div>
                        <div className="flex-1 overflow-hidden text-right">
                           <p className="text-[9px] font-black uppercase text-white/20 tracking-widest">Saída (Target)</p>
                           <p className="text-xs font-bold text-white/60 truncate italic">{targetName || '--'}</p>
                        </div>
                     </div>
                  </div>

                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/[0.03]">
                    <div className="flex items-center gap-4">
                       <div className="flex items-center gap-1.5 grayscale opacity-40">
                         <FileText size={12} className={hasTemplate ? "text-kinetic-orange" : "text-white/20"} />
                         <span className="text-[10px] font-bold uppercase tracking-tight">Template {hasTemplate ? '✓' : '--'}</span>
                       </div>
                       <div className="w-[1px] h-3 bg-white/10" />
                       <div className="flex items-center gap-1.5 opacity-40">
                         <Activity size={12} className="text-emerald-500 animate-pulse" />
                         <span className="text-[10px] font-bold uppercase tracking-tight italic">Live Feed</span>
                       </div>
                    </div>
                     <div className="flex items-center gap-2">
                      {source.source_type === 'radar_offers' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-10 w-10 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all ${syncingId === source.id ? 'text-kinetic-orange' : 'text-white/40'}`}
                          onClick={() => handleSync(source.id)}
                          disabled={syncingId !== null}
                        >
                          <RefreshCw size={14} className={syncingId === source.id ? 'animate-spin' : ''} />
                        </Button>
                      )}
                      
                      <Button 
                        variant="ghost" 
                        className="h-10 text-[10px] font-black uppercase tracking-widest gap-2 bg-white/5 hover:bg-kinetic-orange hover:text-white transition-all rounded-xl border border-white/5"
                        onClick={() => router.push(`/automacoes/${source.id}`)}
                      >
                        GERENCIAR <Settings size={14} className="group-hover:rotate-45 transition-transform" />
                      </Button>
                    </div>
                  </div>
                </div>
              </TactileCard>
            )
          })
        ) : (
          <div className="col-span-full py-24 text-center bg-white/5 rounded-[40px] border-2 border-dashed border-white/5 flex flex-col items-center gap-6">
             <div className="p-6 bg-white/5 rounded-full shadow-skeuo-flat border border-white/5">
                <ShieldCheck size={48} className="text-white/10" />
             </div>
             <div className="space-y-1">
                <p className="text-white/80 font-black uppercase tracking-[0.2em] text-sm italic">Nenhuma esteira operacional</p>
                <p className="text-white/20 text-[10px] font-medium uppercase tracking-widest">Comece criando sua primeira automação de monitoramento</p>
             </div>
             <KineticButton 
              className="h-12 px-8 rounded-2xl shadow-glow-orange-intense/10"
              onClick={() => setIsNewMonitorOpen(true)}
             >
              Configurar Primeiro Monitor
             </KineticButton>
          </div>
        )}
      </div>
    </LayoutContainer>
  );
}
