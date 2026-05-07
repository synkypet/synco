'use client';

import React from 'react';
import Image from 'next/image';
import { TactileCard } from '@/components/ui/TactileCard';
import { Badge } from '@/components/ui/badge';
import { 
  ShoppingBag, 
  ArrowRight, 
  MessageCircle, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Target
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AutomationFactualFeedProps {
  campaigns: any[];
  isLoading: boolean;
}

export function AutomationFactualFeed({ campaigns, isLoading }: AutomationFactualFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 bg-white/5 rounded-2xl border border-white/5" />
        ))}
      </div>
    );
  }

  // Achatar itens para exibição individual
  const allItems = campaigns.flatMap(campaign => 
    (campaign.items || []).map((item: any) => ({
      ...item,
      campaignId: campaign.id,
      campaignName: campaign.name,
      sentAt: campaign.created_at,
      destinations: campaign.destinations || [],
      // Tentar inferir status do send_jobs se disponível (via join futuro ou heurística)
      status: campaign.status || 'processed' 
    }))
  ).sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

  if (allItems.length === 0) {
    return (
      <TactileCard className="p-20 border-none bg-deep-void/40 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/5">
           <ShoppingBag size={32} className="text-white/10" />
        </div>
        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white/40 mb-2">Monitoramento Silencioso</h3>
        <p className="text-[10px] text-white/20 max-w-xs uppercase font-bold leading-relaxed tracking-wider">
          O Radar está operando em segundo plano. Nenhum envio foi realizado nas últimas horas com os filtros atuais.
        </p>
      </TactileCard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <div className="flex flex-col">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 flex items-center gap-2">
            <Target size={14} className="text-kinetic-orange" />
            Despachos Reais em Tempo Real
          </h3>
          <span className="text-[8px] font-bold text-white/10 uppercase mt-1 tracking-widest">Acompanhamento factual das entregas da esteira</span>
        </div>
        <Badge variant="outline" className="text-[8px] border-emerald-500/20 text-emerald-500 uppercase tracking-widest font-black px-2 py-0.5">
           {allItems.length} Envios Recentes
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {allItems.slice(0, 10).map((item: any, i: number) => {
          const product = item.product || {};
          const destinations = item.destinations || [];
          const score = product.opportunity_score || 0;

          return (
            <TactileCard 
              key={`${item.id}-${i}`}
              className="group relative overflow-hidden p-0 border border-white/5 bg-anthracite-surface/40 hover:bg-white/[0.05] transition-all duration-300"
            >
              <div className="flex items-stretch h-32">
                {/* Product Image Section */}
                <div className="w-32 h-full relative overflow-hidden flex-shrink-0 border-r border-white/5">
                  {product.image_url ? (
                    <Image 
                      src={product.image_url} 
                      alt={product.name || ''} 
                      fill
                      unoptimized
                      className="object-cover opacity-90 group-hover:scale-110 transition-transform duration-700" 
                    />
                  ) : (
                    <div className="w-full h-full bg-deep-void flex items-center justify-center">
                      <ShoppingBag size={24} className="text-white/10" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                  
                  {/* Score Overlay */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10">
                     <TrendingUp size={10} className={cn(score >= 70 ? "text-emerald-500" : "text-blue-500")} />
                     <span className="text-[9px] font-black text-white">{score}</span>
                  </div>
                </div>

                {/* Content Section */}
                <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                       <span className="text-[8px] font-black uppercase text-kinetic-orange tracking-widest opacity-80">Shopee Radar</span>
                       <span className="text-[8px] font-mono text-white/30 uppercase">
                          {formatDistanceToNow(new Date(item.sentAt), { addSuffix: true, locale: ptBR })}
                       </span>
                    </div>
                    <h4 className="text-[12px] font-bold text-white/90 leading-tight truncate pr-8">
                      {product.name || 'Produto sem título'}
                    </h4>
                  </div>

                  <div className="flex items-end justify-between">
                    <div className="space-y-3">
                       <div className="flex items-baseline gap-2">
                          <span className="text-sm font-black text-white tracking-tighter">
                             R$ {product.current_price?.toFixed(2) || '0.00'}
                          </span>
                          <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">
                             {product.commission_percent || 0}% Comis.
                          </span>
                       </div>
                       
                       <div className="flex items-center gap-3">
                          <div className="flex -space-x-2">
                             {destinations.slice(0, 3).map((dest: any, idx: number) => (
                                <div key={idx} className="w-6 h-6 rounded-full bg-deep-void border border-white/10 flex items-center justify-center shadow-lg">
                                   <MessageCircle size={12} className="text-white/40" />
                                </div>
                             ))}
                             {destinations.length > 3 && (
                                <div className="w-6 h-6 rounded-full bg-deep-void border border-white/10 flex items-center justify-center shadow-lg text-[8px] font-black text-white/20">
                                   +{destinations.length - 3}
                                </div>
                             )}
                          </div>
                          <span className="text-[9px] font-black uppercase text-white/30 tracking-tight">
                             Enviado para {destinations.length} canais
                          </span>
                       </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                       <Badge className="bg-emerald-500/10 text-emerald-500 border-none font-black text-[8px] uppercase tracking-widest gap-1.5 h-6 px-3">
                          <CheckCircle2 size={10} /> Entregue
                       </Badge>
                       <a 
                         href={`/campanhas/${item.campaignId}`}
                         className="flex items-center gap-1 text-[9px] font-black uppercase text-kinetic-orange hover:text-white transition-colors tracking-widest group/link"
                       >
                         Ver Campanha <ChevronRight size={10} className="group-hover/link:translate-x-0.5 transition-transform" />
                       </a>
                    </div>
                  </div>
                </div>
              </div>
            </TactileCard>
          );
        })}
      </div>
    </div>
  );
}
