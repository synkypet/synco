// src/components/automation/OriginBlock.tsx
'use client';

import React, { useState } from 'react';
import { AutomationSource, AutomationRoute } from '@/types/automation';
import { TactileCard } from '@/components/ui/TactileCard';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { KineticButton } from '@/components/ui/KineticButton';
import { 
  Zap, 
  Target, 
  ShoppingBag, 
  BarChart3, 
  Filter, 
  DollarSign, 
  ShieldCheck,
  BadgePercent,
  Users,
  Plus,
  Trash2,
  Save,
  Clock,
  Loader2
} from 'lucide-react';
import { KeywordManager, Keyword } from '@/components/automation/KeywordManager';
import { SHOPEE_SORT_TYPE, SHOPEE_SORT_TYPE_LABELS } from '@/lib/constants/shopee';

interface OriginBlockProps {
  source: AutomationSource;
  onUpdate: (updates: Partial<AutomationSource>) => void;
  allGroups?: any[];
  targetNames?: Record<string, string>;
  onAddDestination?: () => void;
  onDeleteDestination?: (id: string) => void;
}

export function OriginBlock({ 
  source, 
  onUpdate, 
  allGroups = [], 
  targetNames = {},
  onAddDestination,
  onDeleteDestination
}: OriginBlockProps) {
  const initialKeywords = (source.config?.keywords || []) as Keyword[];
  const config = source.config || {};
  const [localKeywords, setLocalKeywords] = useState<Keyword[]>(initialKeywords);

  const [localConfig, setLocalConfig] = useState<any>(() => ({ ...config }));
  const [localFilters, setLocalFilters] = useState<any>(() => ({ ...source.automation_routes?.[0]?.filters }));
  const [isDirty, setIsDirty] = useState(false);

  const filters = localFilters;

  const handleUpdateLocalConfig = (updates: any) => {
    setLocalConfig((prev: any) => ({ ...prev, ...updates }));
    setIsDirty(true);
  };

  const handleUpdateLocalFilters = (updates: any) => {
    setLocalFilters((prev: any) => ({ ...prev, ...updates }));
    setIsDirty(true);
  };

  const handleSave = () => {
    // Garantir persistência explícita dos filtros no config para auditoria
    const updatedConfig = { 
      ...config, 
      ...localConfig, 
      min_discount_percent: localFilters.min_discount_percent,
      only_official_stores: localFilters.only_official_stores,
      min_price: localFilters.min_price,
      max_price: localFilters.max_price,
      preset_type: 'custom' 
    };

    onUpdate({ config: updatedConfig });
    
    if (source.automation_routes?.[0]) {
      const newRoutes = [...source.automation_routes];
      newRoutes[0] = {
        ...newRoutes[0],
        filters: { ...newRoutes[0].filters, ...localFilters }
      };
      onUpdate({ automation_routes: newRoutes });
    }
    
    setIsDirty(false);
  };

  const currentOriginGroup = allGroups.find(g => g.remote_id === source.external_group_id);

  return (
    <TactileCard className="p-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-kinetic-orange/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Header Compacto */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-kinetic-orange/10 flex items-center justify-center shadow-glow-orange/5 border border-kinetic-orange/20">
              <Zap size={14} className="text-kinetic-orange" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">
              {source.source_type === 'group_monitor' ? 'Centro de Comando de Monitoramento' : 'Centro de Comando do Radar'}
            </h3>
          </div>
          <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest ml-9">
            {source.source_type === 'group_monitor' 
              ? 'Monitoramento em tempo real de mensagens e links.' 
              : 'Nichos de interesse e critérios de seleção automática.'}
          </p>
        </div>
        
        <div className="px-3 py-1.5 rounded-lg bg-deep-void/50 border border-white/5 flex items-center gap-2.5 shadow-skeuo-pressed self-start md:self-center">
           <ShoppingBag size={12} className="text-white/40" />
           <span className="text-[9px] font-black uppercase tracking-widest text-white/60">Shopee Brasil</span>
           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-glow-emerald animate-pulse" />
        </div>
      </div>

      {source.source_type !== 'group_monitor' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
          
          {/* COLUNA 1: NICHOS (KEYWORDS) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <Label className="text-[9px] uppercase font-black tracking-widest text-white/30 flex items-center gap-2">
                <Target size={12} className="text-kinetic-orange" /> 1. Nichos de Produtos
              </Label>
            </div>

            <div className="p-1 rounded-[24px] bg-deep-void/30 border border-white/5 shadow-skeuo-pressed">
              <KeywordManager 
                keywords={localKeywords}
                onChange={(k) => {
                  setLocalKeywords(k);
                  onUpdate({ config: { ...config, keywords: k as any } });
                }}
                maxKeywords={5}
              />
            </div>
          </div>

          {/* COLUNA 2: CRITÉRIOS DE SELEÇÃO */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <Label className="text-[9px] uppercase font-black tracking-widest text-white/30 flex items-center gap-2">
                <Filter size={12} className="text-emerald-400" /> 2. Critérios de Seleção
              </Label>
            </div>

            <div className="space-y-4 p-6 rounded-[24px] bg-deep-void/30 border border-white/5 shadow-skeuo-pressed">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Estratégia de Busca */}
                <div className="space-y-2">
                  <Label className="text-[8px] uppercase font-black text-white/20 ml-1 flex items-center gap-2">
                    <BarChart3 size={10} className="text-kinetic-orange" /> Estratégia
                  </Label>
                  <Select 
                    value={(localConfig.sortType || SHOPEE_SORT_TYPE.RELEVANCE).toString()} 
                    onValueChange={(v) => handleUpdateLocalConfig({ sortType: parseInt(v) })}
                  >
                    <SelectTrigger className="h-10 bg-deep-void border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-skeuo-pressed">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-anthracite-surface border-white/10">
                      <SelectItem value={SHOPEE_SORT_TYPE.RELEVANCE.toString()} className="text-[9px] font-bold uppercase tracking-widest">{SHOPEE_SORT_TYPE_LABELS[SHOPEE_SORT_TYPE.RELEVANCE]}</SelectItem>
                      <SelectItem value={SHOPEE_SORT_TYPE.BEST_SELLERS.toString()} className="text-[9px] font-bold uppercase tracking-widest">{SHOPEE_SORT_TYPE_LABELS[SHOPEE_SORT_TYPE.BEST_SELLERS]}</SelectItem>
                      <SelectItem value={SHOPEE_SORT_TYPE.TOP_COMMISSION.toString()} className="text-[9px] font-bold uppercase tracking-widest">{SHOPEE_SORT_TYPE_LABELS[SHOPEE_SORT_TYPE.TOP_COMMISSION]}</SelectItem>
                      <SelectItem value={SHOPEE_SORT_TYPE.HIGHEST_DISCOUNT.toString()} className="text-[9px] font-bold uppercase tracking-widest">{SHOPEE_SORT_TYPE_LABELS[SHOPEE_SORT_TYPE.HIGHEST_DISCOUNT]}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Desconto Mínimo (Readicionado como Select) */}
                <div className="space-y-2">
                  <Label className="text-[8px] uppercase font-black text-white/20 ml-1 flex items-center gap-2">
                    <BadgePercent size={10} className="text-emerald-500" /> Desconto Mín.
                  </Label>
                  <Select 
                    value={(filters.min_discount_percent || 0).toString()} 
                    onValueChange={(v) => handleUpdateLocalFilters({ min_discount_percent: parseInt(v) })}
                  >
                    <SelectTrigger className="h-10 bg-deep-void border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-skeuo-pressed">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-anthracite-surface border-white/10">
                      <SelectItem value="0" className="text-[9px] font-bold uppercase tracking-widest">Qualquer</SelectItem>
                      <SelectItem value="10" className="text-[9px] font-bold uppercase tracking-widest">10%+</SelectItem>
                      <SelectItem value="20" className="text-[9px] font-bold uppercase tracking-widest">20%+</SelectItem>
                      <SelectItem value="30" className="text-[9px] font-bold uppercase tracking-widest">30%+</SelectItem>
                      <SelectItem value="50" className="text-[9px] font-bold uppercase tracking-widest">50%+</SelectItem>
                      <SelectItem value="70" className="text-[9px] font-bold uppercase tracking-widest">70%+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Faixa de Preço */}
              <div className="space-y-2">
                <Label className="text-[8px] uppercase font-black text-white/20 ml-1 flex items-center gap-2">
                   <DollarSign size={10} className="text-kinetic-orange" /> Faixa de Preço (R$)
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-white/10 uppercase">Min</span>
                    <input 
                      type="number" 
                      className="bg-deep-void border-white/5 h-10 w-full pl-9 text-[10px] font-black rounded-xl text-center shadow-skeuo-pressed outline-none focus:border-kinetic-orange/30 transition-colors"
                      value={filters.min_price || ''}
                      onChange={(e) => handleUpdateLocalFilters({ min_price: Number(e.target.value) })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-white/10 uppercase">Max</span>
                    <input 
                      type="number" 
                      className="bg-deep-void border-white/5 h-10 w-full pl-9 text-[10px] font-black rounded-xl text-center shadow-skeuo-pressed outline-none focus:border-kinetic-orange/30 transition-colors"
                      value={filters.max_price || ''}
                      onChange={(e) => handleUpdateLocalFilters({ max_price: Number(e.target.value) })}
                      placeholder="Sem limite"
                    />
                  </div>
                </div>
              </div>

              {/* Toggles Compactos */}
              <div className="pt-2 border-t border-white/5">
                 <div className="flex items-center justify-between p-3 rounded-xl bg-deep-void/40 border border-white/5 shadow-skeuo-pressed">
                    <div className="flex items-center gap-2.5">
                       <ShieldCheck size={14} className="text-emerald-500" />
                       <div className="flex flex-col">
                          <span className="text-[9px] font-black uppercase tracking-widest text-white/80 leading-none">Lojas Oficiais</span>
                          <span className="text-[7px] font-bold uppercase text-white/10 mt-0.5 tracking-tighter">Shopee Oficial / Indicado</span>
                       </div>
                    </div>
                    <Switch 
                      checked={filters.only_official_stores} 
                      onCheckedChange={(v) => handleUpdateLocalFilters({ only_official_stores: v })}
                      className="scale-75"
                    />
                 </div>
              </div>

              {/* Frequência e Janela de Envio */}
                  <div className="pt-2 border-t border-white/5 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[8px] uppercase font-black text-white/20 ml-1">Intervalo entre produtos</Label>
                      <div className="relative">
                        <Input 
                          type="number" 
                          min="1" 
                          max="1440" 
                          placeholder="1" 
                          value={localConfig.send_interval_minutes ?? localConfig.interval_minutes ?? ''} 
                          onChange={(e) => handleUpdateLocalConfig({ send_interval_minutes: parseInt(e.target.value) || 1 })}
                          className="bg-deep-void border-white/5 h-10 w-full pl-3 pr-20 text-[10px] font-black rounded-xl text-center shadow-skeuo-pressed outline-none focus:border-kinetic-orange/30 transition-colors"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-white/20 uppercase pointer-events-none">minuto(s)</span>
                      </div>
                      <p className="text-[8px] text-white/30 font-medium leading-tight ml-1">
                        Define a pausa entre produtos diferentes. Exemplo: 5 minutos = o próximo produto só será iniciado após essa pausa.
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={12} className="text-emerald-500/50" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/60">Proteção Anti-Spam</span>
                      </div>
                      <p className="text-[8px] text-white/30 font-medium leading-normal italic">
                        Os grupos da mesma campanha são enviados gradualmente com proteção automática: aproximadamente 1 grupo a cada ~5,5 segundos por canal.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-kinetic-orange/50" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/60">Horário de Envio</span>
                      </div>
                      <p className="text-[8px] text-white/30 font-medium leading-normal italic">
                        Os horários permitidos para envio são configurados globalmente nas Configurações Gerais da conta.
                      </p>
                    </div>
                  </div>

              {/* Botão de Salvar */}
              <div className="pt-6 flex justify-end border-t border-white/5">
                {isDirty ? (
                  <KineticButton onClick={handleSave} className="gap-2 h-10 px-6 rounded-xl animate-in fade-in duration-300">
                    <Save size={16} /> Salvar alterações
                  </KineticButton>
                ) : (
                  <span className="text-[10px] uppercase font-black tracking-widest text-emerald-500/50 italic mr-2 self-center animate-in fade-in duration-300 flex items-center gap-1.5">
                    <ShieldCheck size={12} /> Configurações salvas
                  </span>
                )}
              </div>
            </div>
          </div>

        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-6 items-center py-6">
          
          {/* ORIGEM */}
          <div className="md:col-span-3 space-y-4">
            <Label className="text-[9px] uppercase font-black tracking-widest text-white/30 flex items-center gap-2 px-1">
              <Users size={12} className="text-kinetic-orange" /> Fonte de Monitoramento (Origem)
            </Label>
            <div className="p-6 rounded-[32px] bg-deep-void/30 border border-white/5 shadow-skeuo-pressed space-y-4">
              <Select 
                value={source.external_group_id || ''} 
                onValueChange={(v) => onUpdate({ external_group_id: v })}
              >
                <SelectTrigger className="h-14 bg-deep-void border-white/5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-skeuo-pressed">
                  <SelectValue placeholder="Selecione o grupo de origem" />
                </SelectTrigger>
                <SelectContent className="bg-anthracite-surface border-white/10">
                  {allGroups.map((group) => (
                    <SelectItem key={group.id} value={group.remote_id || ''} className="text-[10px] font-bold uppercase tracking-widest">
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-3 px-1">
                <div className={`w-1.5 h-1.5 rounded-full ${currentOriginGroup ? 'bg-emerald-500 animate-pulse shadow-glow-emerald' : 'bg-kinetic-orange animate-pulse shadow-glow-orange'}`} />
                <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">
                  {currentOriginGroup 
                    ? `Monitoramento Ativo: ${currentOriginGroup.name}` 
                    : 'Aguardando seleção de grupo...'}
                </p>
              </div>
            </div>
          </div>

          {/* FLUXO (SETA) */}
          <div className="md:col-span-1 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center shadow-skeuo-flat relative">
               <div className="absolute inset-0 bg-kinetic-orange/5 blur-xl rounded-full animate-pulse" />
               <Zap size={20} className="text-kinetic-orange relative z-10 animate-pulse" />
            </div>
          </div>

          {/* DESTINOS DE ENVIO */}
          <div className="md:col-span-3 space-y-4">
            <div className="flex items-center justify-between px-1">
              <Label className="text-[9px] uppercase font-black tracking-widest text-white/30 flex items-center gap-2">
                <Target size={12} className="text-kinetic-orange" /> Destinos de Envio
              </Label>
              <button 
                onClick={onAddDestination}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-kinetic-orange hover:bg-kinetic-orange/10 hover:border-kinetic-orange/20 transition-all shadow-skeuo-flat"
              >
                <Plus size={10} />
                <span className="text-[8px] font-black uppercase tracking-widest">Adicionar</span>
              </button>
            </div>
            
            <div className="p-4 rounded-[32px] bg-deep-void/30 border border-white/5 shadow-skeuo-pressed space-y-3 min-h-[140px] max-h-[180px] overflow-y-auto custom-scrollbar">
              {source.automation_routes?.length ? (
                source.automation_routes.map((r, idx) => (
                  <div 
                    key={idx} 
                    className="group flex items-center justify-between p-2.5 rounded-xl bg-deep-void/50 border border-white/5 hover:border-white/10 transition-all shadow-skeuo-pressed"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                       <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                          {r.target_type === 'group' ? <Users size={10} /> : <Target size={10} />}
                       </div>
                       <span className="text-[10px] font-bold text-white/60 truncate uppercase tracking-widest">
                          {targetNames[r.id] || (r.target_type === 'group' ? 'Grupo...' : 'Lista...')}
                       </span>
                    </div>
                    <button 
                      onClick={() => onDeleteDestination?.(r.id)}
                      className="p-1.5 text-white/10 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-2 py-8 opacity-10">
                  <Target size={24} />
                  <span className="text-[8px] font-black uppercase tracking-widest italic text-center">Nenhum destino configurado para envio em tempo real</span>
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </TactileCard>
  );
}
