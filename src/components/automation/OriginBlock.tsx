// src/components/automation/OriginBlock.tsx
'use client';

import React, { useState } from 'react';
import { AutomationSource, AutomationRoute } from '@/types/automation';
import { TactileCard } from '@/components/ui/TactileCard';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Zap, 
  Target, 
  Settings2, 
  ShoppingBag, 
  Clock, 
  BarChart3, 
  Filter, 
  DollarSign, 
  Percent, 
  Tag, 
  ShieldCheck, 
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { KeywordManager, Keyword } from '@/components/automation/KeywordManager';
import { SHOPEE_SORT_TYPE, SHOPEE_SORT_TYPE_LABELS } from '@/lib/constants/shopee';

interface OriginBlockProps {
  source: AutomationSource;
  onUpdate: (updates: Partial<AutomationSource>) => void;
}

export function OriginBlock({ source, onUpdate }: OriginBlockProps) {
  const isRadar = source.source_type === 'radar_offers';
  const initialKeywords = (source.config?.keywords || []) as Keyword[];
  const config = source.config || {};
  const [localKeywords, setLocalKeywords] = useState<Keyword[]>(initialKeywords);
  const [isEditingKeyword] = useState(false);

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
    <TactileCard className="p-8 space-y-10 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-kinetic-orange/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-kinetic-orange/10 flex items-center justify-center shadow-glow-orange/5 border border-kinetic-orange/20">
              <Zap size={18} className="text-kinetic-orange" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">Centro de Comando do Radar</h3>
          </div>
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest ml-10">
            Configure o comportamento do robô de descoberta e os critérios de seleção automática.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-deep-void/50 border border-white/5 flex items-center gap-3 shadow-skeuo-pressed">
             <ShoppingBag size={14} className="text-white/40" />
             <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Shopee Brasil</span>
             <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-glow-emerald animate-pulse" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* COLUNA 1: NICHOS (KEYWORDS) */}
        <div className="xl:col-span-4 space-y-6">
          <div className="flex items-center justify-between px-1">
            <Label className="text-[10px] uppercase font-black tracking-widest text-white/40 flex items-center gap-2">
              <Target size={14} className="text-kinetic-orange" /> 1. Nichos de Produtos
            </Label>
          </div>

          <div className="p-1 rounded-3xl bg-deep-void/30 border border-white/5 shadow-skeuo-pressed">
            <KeywordManager 
              keywords={localKeywords}
              onChange={(k) => {
                setLocalKeywords(k);
                onUpdate({ config: { ...config, keywords: k as any } });
              }}
              maxKeywords={8}
            />
          </div>
          
          <p className="px-2 text-[9px] font-bold text-white/20 uppercase leading-relaxed tracking-wider">
            O radar irá varrer a Shopee em busca dessas palavras-chave para encontrar ofertas factuais.
          </p>
        </div>

        {/* COLUNA 2: RITMO E ESTRATÉGIA */}
        <div className="xl:col-span-4 space-y-6">
          <div className="flex items-center justify-between px-1">
            <Label className="text-[10px] uppercase font-black tracking-widest text-white/40 flex items-center gap-2">
              <Settings2 size={14} className="text-blue-400" /> 2. Ritmo e Estratégia
            </Label>
          </div>

          <div className="space-y-4 p-6 rounded-3xl bg-deep-void/30 border border-white/5 shadow-skeuo-pressed">
            {/* Estratégia */}
            <div className="space-y-2">
              <Label className="text-[9px] uppercase font-bold text-white/30 ml-1">Estratégia de Busca</Label>
              <Select 
                value={(config.sortType || SHOPEE_SORT_TYPE.RELEVANCE).toString()} 
                onValueChange={(v) => handleUpdateConfig({ sortType: parseInt(v) })}
              >
                <SelectTrigger className="h-12 bg-deep-void border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-skeuo-pressed">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={14} className="text-kinetic-orange" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-anthracite-surface border-white/10">
                  <SelectItem value={SHOPEE_SORT_TYPE.RELEVANCE.toString()} className="text-[10px] font-bold uppercase tracking-widest">{SHOPEE_SORT_TYPE_LABELS[SHOPEE_SORT_TYPE.RELEVANCE]}</SelectItem>
                  <SelectItem value={SHOPEE_SORT_TYPE.BEST_SELLERS.toString()} className="text-[10px] font-bold uppercase tracking-widest">{SHOPEE_SORT_TYPE_LABELS[SHOPEE_SORT_TYPE.BEST_SELLERS]}</SelectItem>
                  <SelectItem value={SHOPEE_SORT_TYPE.TOP_COMMISSION.toString()} className="text-[10px] font-bold uppercase tracking-widest">{SHOPEE_SORT_TYPE_LABELS[SHOPEE_SORT_TYPE.TOP_COMMISSION]}</SelectItem>
                  <SelectItem value={SHOPEE_SORT_TYPE.HIGHEST_DISCOUNT.toString()} className="text-[10px] font-bold uppercase tracking-widest">{SHOPEE_SORT_TYPE_LABELS[SHOPEE_SORT_TYPE.HIGHEST_DISCOUNT]}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Frequência */}
            <div className="space-y-2">
              <Label className="text-[9px] uppercase font-bold text-white/30 ml-1">Frequência de Varredura</Label>
              <Select 
                value={(config.cooldown_minutes || 60).toString()} 
                onValueChange={(v) => handleUpdateConfig({ cooldown_minutes: parseInt(v) })}
              >
                <SelectTrigger className="h-12 bg-deep-void border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-skeuo-pressed">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-blue-400" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-anthracite-surface border-white/10">
                  <SelectItem value="5" className="text-[10px] font-bold uppercase tracking-widest">Turbinado (5 min)</SelectItem>
                  <SelectItem value="20" className="text-[10px] font-bold uppercase tracking-widest">Agressivo (20 min)</SelectItem>
                  <SelectItem value="60" className="text-[10px] font-bold uppercase tracking-widest">Padrão (1h)</SelectItem>
                  <SelectItem value="120" className="text-[10px] font-bold uppercase tracking-widest">Conservador (2h)</SelectItem>
                  <SelectItem value="360" className="text-[10px] font-bold uppercase tracking-widest">Lento (6h)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Volume */}
            <div className="space-y-2">
              <Label className="text-[9px] uppercase font-bold text-white/30 ml-1">Volume por Ciclo</Label>
              <Select 
                value={(config.batchLimit || 20).toString()} 
                onValueChange={(v) => handleUpdateConfig({ batchLimit: parseInt(v) })}
              >
                <SelectTrigger className="h-12 bg-deep-void border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-skeuo-pressed">
                  <div className="flex items-center gap-2">
                    <Zap size={14} className="text-emerald-400" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="bg-anthracite-surface border-white/10">
                  <SelectItem value="10" className="text-[10px] font-bold uppercase tracking-widest">Curadoria (10 itens)</SelectItem>
                  <SelectItem value="20" className="text-[10px] font-bold uppercase tracking-widest">Padrão (20 itens)</SelectItem>
                  <SelectItem value="30" className="text-[10px] font-bold uppercase tracking-widest">Intenso (30 itens)</SelectItem>
                  <SelectItem value="50" className="text-[10px] font-bold uppercase tracking-widest">Explosivo (50 itens)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* COLUNA 3: FILTROS DE CURADORIA */}
        <div className="xl:col-span-4 space-y-6">
          <div className="flex items-center justify-between px-1">
            <Label className="text-[10px] uppercase font-black tracking-widest text-white/40 flex items-center gap-2">
              <Filter size={14} className="text-emerald-400" /> 3. Critérios de Seleção
            </Label>
          </div>

          <div className="space-y-6 p-6 rounded-3xl bg-deep-void/30 border border-white/5 shadow-skeuo-pressed">
            {/* Score Mínimo */}
            <div className="space-y-3">
              <Label className="text-[9px] uppercase font-bold text-white/30 ml-1 flex items-center gap-2">
                <CheckCircle2 size={10} className="text-kinetic-orange" /> Qualidade Mínima (Score)
              </Label>
              <div className="flex items-center gap-3">
                <Input 
                  type="number" 
                  className="bg-deep-void border-white/5 h-12 text-sm font-black text-kinetic-orange w-20 rounded-xl shadow-skeuo-pressed text-center"
                  value={filters.min_score || 15}
                  onChange={(e) => handleUpdateFilters({ min_score: Number(e.target.value) })}
                  min={0}
                  max={100}
                />
                <div className="flex-1">
                  <p className="text-[8px] font-bold text-white/20 uppercase leading-tight">
                    Produtos abaixo de {filters.min_score || 15} <br/>serão ignorados.
                  </p>
                </div>
              </div>
            </div>

            {/* Price Range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[9px] uppercase font-bold text-white/30 ml-1">Preço Mín.</Label>
                <div className="relative">
                  <DollarSign size={10} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                  <Input 
                    type="number" 
                    className="bg-deep-void border-white/5 h-11 pl-8 text-[10px] font-black rounded-xl"
                    value={filters.min_price || ''}
                    onChange={(e) => handleUpdateFilters({ min_price: Number(e.target.value) })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[9px] uppercase font-bold text-white/30 ml-1">Preço Máx.</Label>
                <Input 
                  type="number" 
                  className="bg-deep-void border-white/5 h-11 text-[10px] font-black rounded-xl text-center"
                  value={filters.max_price || ''}
                  onChange={(e) => handleUpdateFilters({ max_price: Number(e.target.value) })}
                  placeholder="Sem limite"
                />
              </div>
            </div>

            {/* Commissions & Discounts */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[9px] uppercase font-bold text-white/30 ml-1">Comis. Mín. %</Label>
                <div className="relative">
                  <Percent size={10} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                  <Input 
                    type="number" 
                    className="bg-deep-void border-white/5 h-11 pl-8 text-[10px] font-black rounded-xl"
                    value={filters.min_commission_rate || ''}
                    onChange={(e) => handleUpdateFilters({ min_commission_rate: Number(e.target.value) })}
                    placeholder="Ex: 10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[9px] uppercase font-bold text-white/30 ml-1">Desc. Mín. %</Label>
                <div className="relative">
                  <Tag size={10} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                  <Input 
                    type="number" 
                    className="bg-deep-void border-white/5 h-11 pl-8 text-[10px] font-black rounded-xl"
                    value={filters.min_discount_percent || ''}
                    onChange={(e) => handleUpdateFilters({ min_discount_percent: Number(e.target.value) })}
                    placeholder="Ex: 20"
                  />
                </div>
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-2">
               <div className="flex items-center justify-between p-3 rounded-2xl bg-deep-void/40 border border-white/5">
                  <div className="flex items-center gap-2">
                     <ShieldCheck size={14} className="text-emerald-500" />
                     <span className="text-[9px] font-black uppercase tracking-tight text-white/60">Apenas Lojas Oficiais</span>
                  </div>
                  <Switch 
                    checked={filters.only_official_stores} 
                    onCheckedChange={(v) => handleUpdateFilters({ only_official_stores: v })}
                    className="scale-75"
                  />
               </div>
               <div className="flex items-center justify-between p-3 rounded-2xl bg-deep-void/40 border border-white/5">
                  <div className="flex items-center gap-2">
                     <Tag size={14} className="text-kinetic-orange" />
                     <span className="text-[9px] font-black uppercase tracking-tight text-white/60">Apenas com Cupom</span>
                  </div>
                  <Switch 
                    checked={filters.only_coupons} 
                    onCheckedChange={(v) => handleUpdateFilters({ only_coupons: v })}
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
