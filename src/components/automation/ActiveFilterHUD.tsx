// src/components/automation/ActiveFilterHUD.tsx
'use client';

import React from 'react';
import { TactileCard } from '@/components/ui/TactileCard';
import { Badge } from '@/components/ui/badge';
import { Filter, Percent, DollarSign, Globe, ShoppingBag, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActiveFilterHUDProps {
  filters: any;
  config: any;
}

export function ActiveFilterHUD({ filters, config }: ActiveFilterHUDProps) {
  const activeFilters = [];

  // Sort Type Logic
  const preset = config.preset_type || 'balanced';
  const sortMap: Record<string, string> = {
    aggressive: 'Mais Vendidos',
    balanced: 'Relevância',
    conservative: 'Maior Comissão'
  };

  activeFilters.push({
    label: 'Ordenação',
    value: sortMap[preset] || 'Relevância',
    icon: TrendingUp,
    color: 'text-kinetic-orange'
  });

  if (filters.min_commission_value || filters.min_commission_percent) {
    activeFilters.push({
      label: 'Comissão Mín.',
      value: `${filters.min_commission_percent || '0'}%`,
      icon: Percent,
      color: 'text-emerald-500'
    });
  }

  if (filters.min_price || filters.max_price) {
    activeFilters.push({
      label: 'Preço',
      value: `R$${filters.min_price || 0} - R$${filters.max_price || '∞'}`,
      icon: DollarSign,
      color: 'text-blue-500'
    });
  }

  activeFilters.push({
    label: 'Origem',
    value: 'Somente Brasil',
    icon: Globe,
    color: 'text-zinc-500'
  });

  return (
    <TactileCard className="p-5 border border-white/5 bg-anthracite-surface/50 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none">
        <Filter size={80} />
      </div>
      
      <div className="flex flex-col gap-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
          <Filter size={14} className="text-white/20" />
          HUD: Filtros Ativos na Curadoria
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {activeFilters.map((f, i) => (
            <div key={i} className="bg-deep-void/40 p-3 rounded-2xl border border-white/5 space-y-1">
              <div className="flex items-center gap-2">
                <f.icon size={10} className={f.color} />
                <span className="text-[8px] font-black uppercase tracking-widest text-white/20">{f.label}</span>
              </div>
              <p className="text-[10px] font-black text-white/80 uppercase truncate">{f.value}</p>
            </div>
          ))}
        </div>
      </div>
    </TactileCard>
  );
}
