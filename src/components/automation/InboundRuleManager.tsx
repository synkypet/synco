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
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Quality & Market */}
        <div className="space-y-6">
          <div className="space-y-3">
            <Label className="text-[10px] uppercase font-black tracking-widest text-kinetic-orange flex items-center gap-2">
              <CheckCircle2 size={12} /> Qualidade Mínima (Score)
            </Label>
            <div className="flex items-center gap-4">
              <Input 
                type="number" 
                className="bg-deep-void border-white/5 h-12 text-sm font-black text-kinetic-orange w-24 rounded-xl shadow-skeuo-pressed"
                value={filters.min_score || 15}
                onChange={(e) => updateField('min_score', Number(e.target.value))}
                min={0}
                max={100}
              />
              <p className="text-[9px] font-bold text-white/30 uppercase leading-tight">
                Produtos com score abaixo deste valor <br/>serão descartados automaticamente.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-[10px] uppercase font-bold opacity-60">Origem Principal</Label>
            <div className="p-4 rounded-2xl bg-deep-void/50 border border-white/5 flex items-center gap-3">
              <ShoppingBag size={14} className="text-white/40" />
              <span className="text-xs font-black uppercase tracking-widest text-white/60">Shopee Brasil</span>
              <Badge variant="outline" className="ml-auto text-[8px] border-emerald-500/20 text-emerald-500">Ativo</Badge>
            </div>
          </div>
        </div>

        {/* Price & Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold opacity-60 flex items-center gap-1">
               <DollarSign size={10} /> Preço Mínimo
            </Label>
            <Input 
              type="number" 
              className="bg-deep-void border-white/5 h-12 text-xs font-bold rounded-xl"
              value={filters.min_price || ''}
              onChange={(e) => updateField('min_price', Number(e.target.value))}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold opacity-60 flex items-center gap-1">
               Preço Máximo
            </Label>
            <Input 
              type="number" 
              className="bg-deep-void border-white/5 h-12 text-xs font-bold rounded-xl"
              value={filters.max_price || ''}
              onChange={(e) => updateField('max_price', Number(e.target.value))}
              placeholder="Sem limite"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold opacity-60 flex items-center gap-1">
               <Percent size={10} /> Comissão Mín. (%)
            </Label>
            <Input 
              type="number" 
              className="bg-deep-void border-white/5 h-12 text-xs font-bold rounded-xl"
              value={filters.min_commission_rate || ''}
              onChange={(e) => updateField('min_commission_rate', Number(e.target.value))}
              placeholder="Ex: 10"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold opacity-60 flex items-center gap-1">
               <Tag size={10} /> Desconto Mín. (%)
            </Label>
            <Input 
              type="number" 
              className="bg-deep-void border-white/5 h-12 text-xs font-bold rounded-xl"
              value={filters.min_discount_percent || ''}
              onChange={(e) => updateField('min_discount_percent', Number(e.target.value))}
              placeholder="Ex: 20"
            />
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-white/5">
         <div className="flex items-center justify-between p-4 rounded-2xl bg-deep-void/50 border border-white/5">
            <div className="flex items-center gap-3">
               <ShieldCheck size={16} className="text-emerald-500" />
               <div>
                 <Label className="text-[11px] font-black uppercase tracking-tight cursor-pointer block">Apenas Lojas Oficiais</Label>
                 <span className="text-[8px] text-white/20 font-bold uppercase">Shopee Oficial / Indicado</span>
               </div>
            </div>
            <Switch 
              checked={filters.only_official_stores} 
              onCheckedChange={(v) => updateField('only_official_stores', v)}
            />
         </div>
         <div className="flex items-center justify-between p-4 rounded-2xl bg-deep-void/50 border border-white/5">
            <div className="flex items-center gap-3">
               <Tag size={16} className="text-kinetic-orange" />
               <div>
                 <Label className="text-[11px] font-black uppercase tracking-tight cursor-pointer block">Apenas com Cupom</Label>
                 <span className="text-[8px] text-white/20 font-bold uppercase">Ofertas com cupom ativo</span>
               </div>
            </div>
            <Switch 
              checked={filters.only_coupons} 
              onCheckedChange={(v) => updateField('only_coupons', v)}
            />
         </div>
      </div>
    </div>
  );
}

import { Badge } from '@/components/ui/badge';
