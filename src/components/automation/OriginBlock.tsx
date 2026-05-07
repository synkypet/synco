// src/components/automation/OriginBlock.tsx
'use client';

import React, { useState } from 'react';
import { AutomationSource, AutomationRoute } from '@/types/automation';
import { TactileCard } from '@/components/ui/TactileCard';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Zap, 
  Target, 
  ShoppingBag, 
  BarChart3, 
  Filter, 
  DollarSign, 
  ShieldCheck,
  BadgePercent
} from 'lucide-react';
import { KeywordManager, Keyword } from '@/components/automation/KeywordManager';
import { SHOPEE_SORT_TYPE, SHOPEE_SORT_TYPE_LABELS } from '@/lib/constants/shopee';

interface OriginBlockProps {
  source: AutomationSource;
  onUpdate: (updates: Partial<AutomationSource>) => void;
}

export function OriginBlock({ source, onUpdate }: OriginBlockProps) {
  const initialKeywords = (source.config?.keywords || []) as Keyword[];
  const config = source.config || {};
  const [localKeywords, setLocalKeywords] = useState<Keyword[]>(initialKeywords);

  // Filtros da primeira rota (Curadoria)
  const filters = source.automation_routes?.[0]?.filters || {};

  const handleUpdateConfig = (updates: any) => {
    onUpdate({ config: { ...config, ...updates, preset_type: 'custom' } });
  };

  const handleUpdateFilters = (updates: any) => {
    if (!source.automation_routes?.[0]) return;
    const newRoutes = [...source.automation_routes];
    newRoutes[0] = {
      ...newRoutes[0],
      filters: { ...newRoutes[0].filters, ...updates }
    };
    onUpdate({ automation_routes: newRoutes });
  };

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
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white">Centro de Comando do Radar</h3>
          </div>
          <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest ml-9">
            Nichos de interesse e critérios de seleção automática.
          </p>
        </div>
        
        <div className="px-3 py-1.5 rounded-lg bg-deep-void/50 border border-white/5 flex items-center gap-2.5 shadow-skeuo-pressed self-start md:self-center">
           <ShoppingBag size={12} className="text-white/40" />
           <span className="text-[9px] font-black uppercase tracking-widest text-white/60">Shopee Brasil</span>
           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-glow-emerald animate-pulse" />
        </div>
      </div>

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
                  value={(config.sortType || SHOPEE_SORT_TYPE.RELEVANCE).toString()} 
                  onValueChange={(v) => handleUpdateConfig({ sortType: parseInt(v) })}
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
                  onValueChange={(v) => handleUpdateFilters({ min_discount_percent: parseInt(v) })}
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
                  <Input 
                    type="number" 
                    className="bg-deep-void border-white/5 h-10 pl-9 text-[10px] font-black rounded-xl text-center shadow-skeuo-pressed"
                    value={filters.min_price || ''}
                    onChange={(e) => handleUpdateFilters({ min_price: Number(e.target.value) })}
                    placeholder="0.00"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-white/10 uppercase">Max</span>
                  <Input 
                    type="number" 
                    className="bg-deep-void border-white/5 h-10 pl-9 text-[10px] font-black rounded-xl text-center shadow-skeuo-pressed"
                    value={filters.max_price || ''}
                    onChange={(e) => handleUpdateFilters({ max_price: Number(e.target.value) })}
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
                    onCheckedChange={(v) => handleUpdateFilters({ only_official_stores: v })}
                    className="scale-75"
                  />
               </div>
            </div>
          </div>
        </div>

      </div>
    </TactileCard>
  );
}
