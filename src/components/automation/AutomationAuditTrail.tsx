// src/components/automation/AutomationAuditTrail.tsx
'use client';

import React from 'react';
import { TactileCard } from '@/components/ui/TactileCard';
import { Badge } from '@/components/ui/badge';
import { History, ExternalLink, MessageCircle, AlertCircle, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AutomationAuditTrailProps {
  campaigns: any[];
  isLoading: boolean;
}

export function AutomationAuditTrail({ campaigns, isLoading }: AutomationAuditTrailProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-white/5 rounded-2xl border border-white/5" />
        ))}
      </div>
    );
  }

  // Achatar campanhas em uma lista de itens enviados
  const allItems = campaigns.flatMap(campaign => 
    (campaign.items || []).map((item: any) => ({
      ...item,
      campaignName: campaign.name,
      sentAt: campaign.created_at,
      destinations: campaign.destinations || []
    }))
  ).sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

  if (allItems.length === 0) {
    return (
      <TactileCard className="p-12 border-none bg-white/[0.02] flex flex-col items-center justify-center text-center">
        <AlertCircle size={40} className="text-white/10 mb-4" />
        <h3 className="text-sm font-black uppercase tracking-widest text-white/40 mb-2">Nenhum item enviado recentemente</h3>
        <p className="text-[10px] text-white/20 max-w-xs uppercase font-bold leading-relaxed">
          Tente ajustar sua keyword para algo menos específico ou mude o preset para "Agressivo" para aumentar o volume de captação.
        </p>
      </TactileCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
          <History size={14} className="text-white/20" />
          Audit Trail: Histórico Detalhado de Envios
        </h3>
        <span className="text-[9px] font-mono text-white/20">{allItems.length} Itens Rastreados</span>
      </div>

      <TactileCard className="overflow-hidden p-0 border border-white/5 bg-anthracite-surface/40">
        <div className="flex flex-col">
          {allItems.slice(0, 15).map((item: any, i: number) => {
            const product = item.product || {};
            const score = product.opportunity_score || 0;
            const destinations = item.destinations || [];

            return (
              <div 
                key={`${item.id}-${i}`}
                className="group flex items-center gap-4 px-5 py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-all"
              >
                {/* Score Indicator */}
                <div className={cn(
                  "w-1 h-10 rounded-full flex-shrink-0",
                  score >= 80 ? "bg-emerald-500 shadow-glow-emerald" :
                  score >= 50 ? "bg-blue-500 shadow-glow-blue" :
                  "bg-zinc-500"
                )} />

                {/* Product Image Thumbnail */}
                <div className="w-12 h-12 rounded-xl bg-deep-void overflow-hidden flex-shrink-0 border border-white/5 relative">
                  {product.image_url ? (
                    <img src={product.image_url} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <ShoppingCart size={16} className="absolute inset-0 m-auto text-white/10" />
                  )}
                  <div className="absolute top-0 right-0 bg-deep-void/80 px-1 rounded-bl-lg">
                    <span className="text-[8px] font-black text-kinetic-orange">{score}</span>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black text-white/80 uppercase truncate group-hover:text-white transition-colors">
                    {product.name || 'Produto s/ Nome'}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-black text-kinetic-orange">
                      R$ {product.current_price?.toFixed(2) || '0.00'}
                    </span>
                    <span className="text-[9px] font-bold text-emerald-500/60 uppercase tracking-widest">
                      {product.commission_percent || 0}% Comis.
                    </span>
                    <div className="flex items-center gap-1 text-white/20">
                      <MessageCircle size={10} />
                      <span className="text-[9px] font-black uppercase truncate max-w-[100px]">
                        {destinations.length} Canais
                      </span>
                    </div>
                  </div>
                </div>

                {/* Date / Metadata */}
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] font-black text-white/40 uppercase">
                    {new Date(item.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-[8px] font-bold text-white/10 uppercase tracking-widest mt-1">
                    {new Date(item.sentAt).toLocaleDateString([], { day: '2-digit', month: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </TactileCard>
    </div>
  );
}
