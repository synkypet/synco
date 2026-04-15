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
  Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';

const COOLDOWN_MS = 5500;

const OPERATIONAL_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  queued:    { label: 'Aguardando fila',     color: 'bg-yellow-500/10 text-yellow-400',                           icon: <Clock size={8} /> },
  cooldown:  { label: 'Aguardando cooldown', color: 'bg-blue-500/10 text-blue-400',                               icon: <Timer size={8} /> },
  sending:   { label: 'Enviando',            color: 'bg-kinetic-orange/10 text-kinetic-orange animate-pulse',     icon: <SendHorizonal size={8} /> },
  completed: { label: 'Finalizada',          color: 'bg-emerald-500/10 text-emerald-400',                         icon: <CheckCircle2 size={8} /> },
};

function useRealtimeEta(queue: QueuePosition | undefined, hasPending: boolean) {
  const [etaLabel, setEtaLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPending || !queue || queue.operationalStatus === 'sending' || queue.operationalStatus === 'completed') {
      setEtaLabel(null);
      return;
    }

    const updateEta = () => {
      const now = Date.now();
      const lastProcessedTime = queue.lastProcessedAt ? new Date(queue.lastProcessedAt).getTime() : now - COOLDOWN_MS;
      const nextAvailableTime = lastProcessedTime + COOLDOWN_MS;

      const queueStartTime = Math.max(now, nextAvailableTime);
      const targetTime = queueStartTime + Math.max(0, queue.position - 1) * COOLDOWN_MS;
      
      const diffMs = Math.max(0, targetTime - now);

      if (diffMs <= 1000) {
        setEtaLabel(queue.position === 1 ? 'agora' : null);
        return;
      }

      if (diffMs < 60000) {
        setEtaLabel(`${Math.ceil(diffMs / 1000)}s`);
      } else {
        setEtaLabel(`~${Math.ceil(diffMs / 60000)}m`);
      }
    };

    updateEta();
    const interval = setInterval(updateEta, 1000);
    return () => clearInterval(interval);
  }, [queue, hasPending]);

  return etaLabel;
}

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

  const realEtaLabel = useRealtimeEta(queue, hasPending);

  // Guard: stats não chegaram ainda OU campanha nova com total=0
  // Impede classificação prematura como 'completed'
  const NEW_THRESHOLD_MS = 3 * 60 * 1000;
  const isRecentlyCreated = campaign.created_at
    ? (Date.now() - new Date(campaign.created_at).getTime()) < NEW_THRESHOLD_MS
    : false;
  const statsTotal = stats?.total ?? 0;
  const isStatsReady = !statsLoading && stats !== null && stats !== undefined;

  let opStatus: string;
  if (!isStatsReady || (statsTotal === 0 && isRecentlyCreated)) {
    opStatus = 'queued'; // Aguardando sincronização — mostra como "na fila"
  } else if ((stats?.processing ?? 0) > 0) {
    opStatus = 'sending';
  } else if ((stats?.pending ?? 0) > 0) {
    opStatus = queue?.position === 1 ? 'cooldown' : 'queued';
  } else {
    opStatus = 'completed';
  }
  
  const statusDef = OPERATIONAL_STATUS[opStatus] ?? OPERATIONAL_STATUS.completed;

  return (
    <TactileCard className="p-0 overflow-hidden border-none group animate-in fade-in duration-500">
      <div className="p-6 flex items-start justify-between gap-4">
        {/* Left: Info */}
        <div className="flex-1 space-y-4">
          <div className="space-y-1">
            <h3 className="text-xs font-black uppercase tracking-widest text-white/90 group-hover:text-kinetic-orange transition-colors">
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

          {/* Queue Position & ETA */}
          {hasPending && queue && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/5">
              <Timer size={10} className="text-white/30 flex-shrink-0" />
              <span className="text-[9px] font-black uppercase tracking-widest text-white/40">
                Pos.{' '}
                <span className="text-white/80">#{queue.position}</span>
                {realEtaLabel && (
                  <> · ETA <span className="text-kinetic-orange">{realEtaLabel}</span></>
                )}
                {queue.pendingInCampaign > 1 && (
                  <> · {queue.pendingInCampaign} msgs</>
                )}
              </span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 pt-2">
             <div className="flex flex-col">
                <span className="text-[10px] font-black text-emerald-500">{stats?.completed || 0}</span>
                <span className="text-[7px] font-black uppercase text-white/20 tracking-tighter">Enviados</span>
             </div>
             <div className="flex flex-col">
                <span className="text-[10px] font-black text-blue-400">{stats?.pending || 0}</span>
                <span className="text-[7px] font-black uppercase text-white/20 tracking-tighter">Pendentes</span>
             </div>
             <div className="flex flex-col">
                <span className="text-[10px] font-black text-red-500">{stats?.failed || 0}</span>
                <span className="text-[7px] font-black uppercase text-white/20 tracking-tighter">Falhas</span>
             </div>
          </div>
        </div>

        {/* Right: Circular Progress */}
        <div className="relative w-20 h-20 flex items-center justify-center">
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
                    opStatus === 'completed' ? "stroke-emerald-500"    : "stroke-blue-400"
                  )}
                  strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress / 100)}`}
                  strokeLinecap="round"
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className="text-xs font-black text-white">{progress}%</span>
                {opStatus === 'sending' && <Loader2 size={8} className="animate-spin text-kinetic-orange mt-0.5" />}
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
