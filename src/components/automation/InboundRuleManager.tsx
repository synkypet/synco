// src/components/automation/InboundRuleManager.tsx
'use client';

import React from 'react';
import { TactileCard } from '@/components/ui/TactileCard';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Filter, DollarSign, Percent, ShoppingBag, Tag, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';

interface InboundFilters {
  min_price?: number;
  max_price?: number;
  min_commission_rate?: number;
  min_discount_percent?: number;
  category?: string;
  marketplace?: string;
  only_official_stores?: boolean;
  only_coupons?: boolean;
  min_score?: number;
}

interface InboundRuleManagerProps {
  filters: InboundFilters;
  onUpdate: (filters: InboundFilters) => void;
}

const MARKETPLACES = [
  { id: 'all', name: 'Todos' },
  { id: 'shopee', name: 'Shopee' },
  { id: 'mercadolivre', name: 'Mercado Livre' }
];

const CATEGORIES = [
  { id: 'all', name: 'Todas' },
  { id: 'eletronicos', name: 'Eletrônicos' },
  { id: 'casa', name: 'Casa e Decoração' },
  { id: 'moda', name: 'Moda' },
  { id: 'beleza', name: 'Beleza' }
];

export function InboundRuleManager({ filters, onUpdate }: InboundRuleManagerProps) {
  const updateField = (field: keyof InboundFilters, value: any) => {
    onUpdate({ ...filters, [field]: value });
  };

  return (
    <TactileCard className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
          <Filter size={14} className="text-kinetic-orange" />
          2. Regras de Seleção (Filtros)
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Market & Category */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold opacity-60">Marketplace</Label>
            <Select value={filters.marketplace || 'all'} onValueChange={(v) => updateField('marketplace', v)}>
              <SelectTrigger className="bg-deep-void border-white/5 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MARKETPLACES.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold opacity-60">Categoria</Label>
            <Select value={filters.category || 'all'} onValueChange={(v) => updateField('category', v)}>
              <SelectTrigger className="bg-deep-void border-white/5 h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Price & Discount */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold opacity-60 flex items-center gap-1">
               <DollarSign size={10} /> Preço Mínimo
            </Label>
            <Input 
              type="number" 
              className="bg-deep-void border-white/5 h-10 text-xs font-bold"
              value={filters.min_price || ''}
              onChange={(e) => updateField('min_price', Number(e.target.value))}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold opacity-60 flex items-center gap-1">
               Max. Preço
            </Label>
            <Input 
              type="number" 
              className="bg-deep-void border-white/5 h-10 text-xs font-bold"
              value={filters.max_price || ''}
              onChange={(e) => updateField('max_price', Number(e.target.value))}
              placeholder="Sem limite"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold opacity-60 flex items-center gap-1">
               <Percent size={10} /> Comissão (%)
            </Label>
            <Input 
              type="number" 
              className="bg-deep-void border-white/5 h-10 text-xs font-bold"
              value={filters.min_commission_rate || ''}
              onChange={(e) => updateField('min_commission_rate', Number(e.target.value))}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold opacity-60 flex items-center gap-1">
               <Tag size={10} /> Desconto (%)
            </Label>
            <Input 
              type="number" 
              className="bg-deep-void border-white/5 h-10 text-xs font-bold"
              value={filters.min_discount_percent || ''}
              onChange={(e) => updateField('min_discount_percent', Number(e.target.value))}
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5">
         <div className="flex items-center justify-between p-3 rounded-xl bg-deep-void/50 border border-white/5">
            <div className="flex items-center gap-2">
               <ShieldCheck size={14} className="text-emerald-500" />
               <Label className="text-[11px] font-bold uppercase tracking-tight cursor-pointer">Apenas Lojas Oficiais</Label>
            </div>
            <Switch 
              checked={filters.only_official_stores} 
              onCheckedChange={(v) => updateField('only_official_stores', v)}
            />
         </div>
         <div className="flex items-center justify-between p-3 rounded-xl bg-deep-void/50 border border-white/5">
            <div className="flex items-center gap-2">
               <ShoppingBag size={14} className="text-kinetic-orange" />
               <Label className="text-[11px] font-bold uppercase tracking-tight cursor-pointer">Apenas com Cupom</Label>
            </div>
            <Switch 
              checked={filters.only_coupons} 
              onCheckedChange={(v) => updateField('only_coupons', v)}
            />
         </div>
      </div>
    </TactileCard>
  );
}
