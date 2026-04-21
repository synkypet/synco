import React, { useState, useEffect } from 'react';
import { Campaign } from '@/types/campaign';
import { useCampaignStats, useQueuePosition, QueuePosition } from '@/hooks/use-campaigns';
import { TactileCard } from '@/components/ui/TactileCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  Clock, 
  AlertCircle, 
  ArrowRight,
  Loader2,
  SendHorizonal,
  CheckCircle2,
  Timer,
  Package,
  LayoutList
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Hook useRealtimeEta removido para evitar indicadores de tempo ilusórios

const OPERATIONAL_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  queued:    { label: 'Na fila',           color: 'bg-yellow-500/10 text-yellow-400',                           icon: <Clock size={8} /> },
  cooldown:  { label: 'Aguardando envio',  color: 'bg-blue-500/10 text-blue-400',                               icon: <Timer size={8} /> },
  sending:   { label: 'Processando',       color: 'bg-kinetic-orange/10 text-kinetic-orange animate-pulse',     icon: <SendHorizonal size={8} /> },
  completed: { label: 'Finalizada',        color: 'bg-emerald-500/10 text-emerald-400',                         icon: <CheckCircle2 size={8} /> },
  failed:    { label: 'Falhou',            color: 'bg-red-500/10 text-red-500',                                 icon: <AlertCircle size={8} /> },
  session_lost: { label: 'Pausada',        color: 'bg-yellow-500/10 text-yellow-500',                           icon: <AlertCircle size={8} /> },
};

interface CampaignCardProps {
  campaign: Campaign;
  onViewDetails: (campaign: Campaign) => void;
}

export function CampaignCard({ campaign, onViewDetails }: CampaignCardProps) {
  // Passa o created_at para o hook para que o polling se mantenha ativo
  // em campanhas recém-criadas onde os send_jobs ainda não refletiram.
  const { data: stats, isLoading: statsLoading } = useCampaignStats(campaign.id, campaign.created_at);
  const hasPending = (stats?.pending ?? 0) > 0 || (stats?.processing ?? 0) > 0;
  const { data: queue } = useQueuePosition(campaign.id, hasPending);

  const progress = stats?.total ? Math.round((stats.completed / stats.total) * 100) : 0;

  // Heurística Etapa 3: Item Único vs Grupo/Lote
  const items = campaign.items || [];
  const isSingleProduct = items.length === 1;
  const productImage = isSingleProduct ? items[0].image_url : null;
  const [imgError, setImgError] = useState(false);

  // Guard: stats não chegaram ainda OU campanha nova com total=0
  // Impede classificação prematura como 'completed'
  const NEW_THRESHOLD_MS = 3 * 60 * 1000;
  const isRecentlyCreated = campaign.created_at
    ? (Date.now() - new Date(campaign.created_at).getTime()) < NEW_THRESHOLD_MS
    : false;
  const statsTotal = stats?.total ?? 0;
  const isStatsReady = !statsLoading && stats !== null && stats !== undefined;

  let opStatus: string;
  if (campaign.status === 'failed') {
    opStatus = 'failed'; // Banco de dados diz explicitamente que a campanha falhou
  } else if (!isStatsReady || (statsTotal === 0 && isRecentlyCreated)) {
    opStatus = 'queued'; // Aguardando sincronização — mostra como "na fila"
  } else if ((stats?.processing ?? 0) > 0) {
    opStatus = 'sending';
  } else if ((stats?.session_lost ?? 0) > 0) {
    opStatus = 'session_lost';
  } else if ((stats?.pending ?? 0) > 0) {
    opStatus = queue?.position === 1 ? 'cooldown' : 'queued';
  } else {
    opStatus = 'completed';
  }
  
  const statusDef = OPERATIONAL_STATUS[opStatus] ?? OPERATIONAL_STATUS.completed;

  return (
    <TactileCard className="p-0 overflow-hidden border-none group animate-in fade-in duration-500">
      <div className="p-6">
        <div className="grid grid-cols-[1fr_auto] gap-6">
          {/* Left Column: Info & Metrics */}
          <div className="flex flex-col justify-between min-w-0">
            {/* Top Line: Name, Date, Status */}
            <div className="space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase tracking-tight text-white/90 group-hover:text-kinetic-orange transition-colors line-clamp-2 leading-tight">
                  {campaign.name || 'Envio Rápido'}
                </h3>
                <div className="flex items-center gap-2 text-[10px] font-bold text-white/20 uppercase tracking-tighter">
                  <Calendar size={10} />
                  {new Date(campaign.created_at || '').toLocaleString()}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={cn(
                  "h-5 text-[8px] font-black uppercase tracking-widest border-none flex items-center gap-1",
                  statusDef.color
                )}>
                  {statusDef.icon}
                  {statusDef.label}
                </Badge>
                {(stats?.failed ?? 0) > 0 && (
                  <Badge variant="outline" className="h-5 text-[8px] font-black uppercase tracking-widest bg-red-500/10 text-red-500 border-none flex items-center gap-1">
                    <AlertCircle size={8} />
                    {stats?.failed} Erros
                  </Badge>
                )}
              </div>
            </div>

            {/* Middle Line: Metrics */}
            <div className="mt-6 flex flex-col gap-4">
              {/* Queue Position & ETA (if active) */}
              {hasPending && queue && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/5 w-fit">
                  <Timer size={10} className="text-white/30 flex-shrink-0" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
                    Pos. <span className="text-white/80">#{queue.position}</span>
                    {queue.pendingInCampaign > 1 && (
                      <> · {queue.pendingInCampaign} msg</>
                    )}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-black text-emerald-500 leading-none">{stats?.completed || 0}</span>
                  <span className="text-[8px] font-black uppercase text-white/20 tracking-tighter">Envios</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-black text-blue-400 leading-none">{stats?.pending || 0}</span>
                  <span className="text-[8px] font-black uppercase text-white/20 tracking-tighter">Proc.</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-black text-red-500 leading-none">{stats?.failed || 0}</span>
                  <span className="text-[8px] font-black uppercase text-white/20 tracking-tighter">Erros</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Progress & Visuals */}
          <div className="flex flex-col items-center gap-4 py-1">
            {/* Right Top: Circular Progress */}
            <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90">
                <circle 
                  cx="40" cy="40" r="34" 
                  className="stroke-white/5 fill-none" 
                  strokeWidth="6" 
                />
                <circle 
                  cx="40" cy="40" r="34" 
                  className={cn(
                    "fill-none transition-all duration-1000 ease-out",
                    opStatus === 'sending'   ? "stroke-kinetic-orange" :
                    opStatus === 'failed'    ? "stroke-red-500" :
                    opStatus === 'session_lost' ? "stroke-yellow-500" :
                    opStatus === 'completed' ? "stroke-emerald-500"    : "stroke-blue-400"
                  )}
                  strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                {opStatus === 'failed' ? (
                  <AlertCircle size={14} className="text-red-500" />
                ) : opStatus === 'session_lost' ? (
                  <AlertCircle size={14} className="text-yellow-500" />
                ) : (
                  <>
                    <span className="text-xs font-black text-white">{progress}%</span>
                    {opStatus === 'sending' && <Loader2 size={8} className="animate-spin text-kinetic-orange mt-0.5" />}
                  </>
                )}
              </div>
            </div>

            {/* Right Middle: Image Thumbnail or Batch Icon */}
            {isSingleProduct ? (
              <div className="w-16 h-16 shrink-0 relative">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-black/40 border border-white/5 shadow-skeuo-pressed">
                  {!imgError && productImage ? (
                    <img 
                      src={productImage} 
                      alt="" 
                      className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white/5">
                      <Package size={20} className="text-white/10" />
                    </div>
                  )}
                </div>
                {/* Glow neon sutil embaixo da imagem */}
                <div className="absolute -bottom-1 inset-x-2 h-1 bg-kinetic-orange/20 blur-md rounded-full" />
              </div>
            ) : (
              <div className="w-16 h-16 shrink-0 flex flex-col items-center justify-center rounded-xl bg-white/5 border border-dashed border-white/10 gap-1.5 p-1 text-center">
                <LayoutList size={20} className="text-white/20" />
                <span className="text-[7px] font-bold text-white/30 uppercase leading-tight">Múltiplos<br/>Itens</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-black/20 flex items-center justify-between border-t border-white/5">
        <span className="text-[8px] font-bold text-white/10 uppercase tracking-widest">
           ID: {campaign.id.split('-')[0]}
        </span>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onViewDetails(campaign)}
          className="h-8 gap-2 bg-white/5 border-none text-[8px] font-black uppercase tracking-widest hover:bg-kinetic-orange/10 hover:text-kinetic-orange group"
        >
          Monitorar
          <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </TactileCard>
  );
}
