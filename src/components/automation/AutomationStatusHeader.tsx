// src/components/automation/AutomationStatusHeader.tsx
'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, Activity, Clock, ShoppingCart, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface AutomationStatusHeaderProps {
  source: any;
  onBack: () => void;
}

export function AutomationStatusHeader({ source, onBack }: AutomationStatusHeaderProps) {
  const isActive = source.is_active;
  const lastRun = source.last_restock_at ? new Date(source.last_restock_at) : null;

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
      <div className="flex items-center gap-5">
        <Button 
          variant="ghost" 
          className="p-0 h-12 w-12 rounded-2xl hover:bg-white/5 border border-white/5 group transition-all" 
          onClick={onBack}
        >
          <ArrowLeft size={20} className="text-white/20 group-hover:text-white/60 transition-colors" />
        </Button>
        
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-3xl font-black italic text-white/90 uppercase tracking-tighter flex items-center gap-2">
              {source.name}
              <Zap size={20} className={cn("text-kinetic-orange", isActive && "animate-pulse")} />
            </h2>
            <div className={cn(
              "h-2 w-2 rounded-full shadow-glow-sm",
              isActive ? "bg-emerald-500 shadow-emerald-500/50" : "bg-zinc-500 shadow-zinc-500/50"
            )} />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Ambiente de Gerenciamento de Pipeline</span>
            <Badge variant="outline" className={cn(
              "text-[9px] font-black tracking-widest uppercase px-2 py-0.5 border-none",
              isActive ? "bg-emerald-500/10 text-emerald-500" : "bg-white/5 text-zinc-500"
            )}>
              {isActive ? 'Operação Ativa' : 'Pausada'}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* KPI: Última Varredura */}
        <div className="bg-white/[0.02] border border-white/5 px-4 py-2 rounded-2xl flex items-center gap-3">
          <Clock size={14} className="text-white/20" />
          <div>
            <p className="text-[8px] font-black uppercase tracking-widest text-white/20">Último Ciclo</p>
            <p className="text-[10px] font-black text-white/60 uppercase">
              {lastRun ? lastRun.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Nunca'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
