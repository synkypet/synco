// src/components/automation/OriginBlock.tsx
'use client';

import React from 'react';
import { TactileCard } from '@/components/ui/TactileCard';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Radio, Activity, ShieldCheck, Power, Inbox, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AutomationSource } from '@/types/automation';

interface OriginBlockProps {
  source: AutomationSource;
  sourceName?: string;
  onUpdate: (updates: Partial<AutomationSource>) => void;
}

export function OriginBlock({ source, sourceName, onUpdate }: OriginBlockProps) {
  const isRadar = source.source_type === 'radar_offers';

  return (
    <TactileCard className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
          {isRadar ? <Inbox size={14} className="text-kinetic-orange" /> : <Radio size={14} className="text-kinetic-orange animate-pulse" />}
          1. Entrada (Source: {isRadar ? 'Radar' : 'Monitor'})
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onUpdate({ is_active: !source.is_active })}
          className={cn(
            "h-8 gap-2 uppercase font-bold text-[9px] tracking-widest px-3",
            source.is_active ? "text-emerald-500 hover:text-emerald-400 bg-emerald-500/5" : "text-zinc-500 hover:text-zinc-400 bg-white/5"
          )}
        >
          <Power size={12} />
          {source.is_active ? 'ON' : 'OFF'}
        </Button>
      </div>

      <div className="space-y-4">
        <div className="bg-deep-void rounded-xl p-4 shadow-skeuo-pressed border border-white/5">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center border shadow-glow-orange-intense",
              isRadar ? "bg-kinetic-orange/20 border-kinetic-orange/40" : "bg-kinetic-orange/10 border-kinetic-orange/20"
            )}>
              {isRadar ? <Inbox size={24} className="text-kinetic-orange" /> : <MessageCircle size={24} className="text-kinetic-orange" />}
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight">{sourceName || source.name}</p>
              <p className="text-[10px] font-mono opacity-40 select-all">
                {isRadar ? 'Busca Global Shopee/ML' : source.external_group_id}
              </p>
            </div>
          </div>
        </div>

        {isRadar ? (
          <div className="bg-kinetic-orange/5 border border-kinetic-orange/20 rounded-lg p-3 flex items-center gap-3">
            <ShieldAlert size={14} className="text-kinetic-orange" />
            <p className="text-[9px] font-bold uppercase tracking-widest text-kinetic-orange">
              Fonte Radar em fase de calibração. A captação será iniciada em breve.
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-glow-emerald" />
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Monitoramento Ativo</span>
            </div>
            <Badge variant="outline" className="text-[9px] font-bold tracking-widest bg-white/5 border-white/10 opacity-60">
              ID: {source.channel_id?.slice(0, 8) || 'N/A'}
            </Badge>
          </div>
        )}
      </div>
    </TactileCard>
  );
}
