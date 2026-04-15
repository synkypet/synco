// src/components/automation/AutomationCampaignSection.tsx
import React from 'react';
import { Campaign } from '@/types/campaign';
import { useCampaignStats, useQueuePosition } from '@/hooks/use-campaigns';
import { TactileCard } from '@/components/ui/TactileCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  CheckCircle2, 
  SendHorizonal, 
  Timer, 
  ArrowRight,
  Zap,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface CampaignMiniCardProps {
  campaign: Campaign;
}

// ─── Status visual unificado (6 estados: com guard para sincronizando) ──────────
type OpStatus = 'syncing' | 'queued' | 'cooldown' | 'sending' | 'completed' | 'failed';

const STATUS_DEF: Record<OpStatus, { label: string; barColor: string; badge: string; icon: React.ReactNode }> = {
  syncing:   { label: 'Preparando', barColor: 'bg-white/20',         badge: 'bg-white/5 text-white/40',                  icon: <RefreshCw size={10} className="animate-spin" /> },
  queued:    { label: 'Na Fila',    barColor: 'bg-yellow-500/60',    badge: 'bg-yellow-500/10 text-yellow-400',           icon: <Clock size={10} /> },
  cooldown:  { label: 'Cooldown',   barColor: 'bg-blue-500/60',      badge: 'bg-blue-500/10 text-blue-400',               icon: <Timer size={10} /> },
  sending:   { label: 'Enviando…',  barColor: 'bg-kinetic-orange',   badge: 'bg-orange-500/10 text-orange-400 animate-pulse', icon: <SendHorizonal size={10} /> },
  completed: { label: 'Concluída',  barColor: 'bg-emerald-500/40',   badge: 'bg-emerald-500/10 text-emerald-400',         icon: <CheckCircle2 size={10} /> },
  failed:    { label: 'Com Erros',  barColor: 'bg-red-500/60',       badge: 'bg-red-500/10 text-red-400',                 icon: <AlertCircle size={10} /> },
};

const NEW_CAMPAIGN_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutos

function resolveStatus(
  statsLoaded: boolean,  // stats ainda não chegaram do backend
  statsTotal: number,    // total de jobs registrados
  hasPending: boolean,
  hasFailed: boolean,
  opStatus: string | undefined,
  isProcessing: boolean,
  createdAt: string | undefined,
): OpStatus {
  // ── Guard: stats ainda carregando ou campanha nova com jobs zerados ──────────
  // Uma campanha recém-criada pode ter stats total=0 porque o worker ainda não
  // publicou os send_jobs. Nesse caso, não classificar como "concluída".
  const isRecentlyCreated = createdAt
    ? (Date.now() - new Date(createdAt).getTime()) < NEW_CAMPAIGN_THRESHOLD_MS
    : false;

  if (!statsLoaded || (statsTotal === 0 && isRecentlyCreated)) {
    return 'syncing';
  }

  // ── Campanha ativa ────────────────────────────────────────────────────────────
  if (hasPending || isProcessing) {
    if (opStatus === 'sending' || isProcessing) return 'sending';
    if (opStatus === 'cooldown') return 'cooldown';
    return 'queued';
  }

  // ── Campanha sem atividade ────────────────────────────────────────────────────
  // Só marca "concluída" se o total de jobs for > 0 (confirmação real do backend)
  if (statsTotal === 0 && isRecentlyCreated) return 'syncing';
  return hasFailed && statsTotal === 0 ? 'failed' : hasFailed ? 'failed' : 'completed';
}

function CampaignMiniCard({ campaign }: CampaignMiniCardProps) {
  const { data: stats, isLoading: statsLoading } = useCampaignStats(campaign.id, campaign.created_at);

  const total      = stats?.total      ?? 0;
  const pending    = stats?.pending    ?? 0;
  const processing = stats?.processing ?? 0;
  const completed  = stats?.completed  ?? 0;
  const failed     = stats?.failed     ?? 0;

  const statsLoaded   = !statsLoading && stats !== null && stats !== undefined;
  const hasPending    = pending > 0 || processing > 0;
  const isProcessing  = processing > 0;
  const hasFailed     = failed > 0 && total > 0;

  const { data: queue } = useQueuePosition(campaign.id, hasPending);

  const opStatus  = resolveStatus(statsLoaded, total, hasPending, hasFailed, queue?.operationalStatus, isProcessing, campaign.created_at);
  const statusDef = STATUS_DEF[opStatus];

  // Linha 3: posição/ETA — só quando há pendências confirmadas
  const queueLabel = (() => {
    if (opStatus === 'syncing')   return null;
    if (!hasPending || !queue)    return null;
    if (opStatus === 'sending')   return 'Enviando agora';
    if (queue.position === 1)     return 'Próxima da fila';
    return `Posição #${queue.position}`;
  })();

  // Linha 2: mostra stats zerados como "—" enquanto sincroniza
  const showSyncingPlaceholder = opStatus === 'syncing';

  return (
    <div className="group flex items-center gap-4 px-4 py-3 bg-white/5 hover:bg-white/[0.08] border-b border-white/5 last:border-0 transition-all">
      {/* Barra lateral de status */}
      <div className={cn("w-0.5 h-10 rounded-full flex-shrink-0 transition-colors duration-700", statusDef.barColor)} />

      {/* Coluna principal */}
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        {/* Linha 1: Nome + Badge de Status */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-white truncate">
            {campaign.name || 'Campanha Automática'}
          </span>
          <Badge className={cn("border-none text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 gap-1 flex-shrink-0 transition-all duration-500", statusDef.badge)}>
            {statusDef.icon}
            {statusDef.label}
          </Badge>
        </div>

        {/* Linha 2: Enviados / Pendentes (ou placeholder de sincronização) */}
        {showSyncingPlaceholder ? (
          <span className="text-[9px] font-bold text-white/20 italic">Aguardando sincronização com fila...</span>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-bold text-emerald-500/80">
              {completed} enviados
            </span>
            {hasPending && (
              <span className="text-[9px] font-bold text-blue-400/80">
                · {pending} pendentes
              </span>
            )}
            {hasFailed && (
              <span className="text-[9px] font-bold text-red-400/80">
                · {failed} falhas
              </span>
            )}
          </div>
        )}

        {/* Linha 3: Posição / ETA — só quando há pendências confirmadas */}
        {queueLabel && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <Timer size={9} className="text-kinetic-orange/60 flex-shrink-0" />
            <span className="text-[8px] font-black uppercase tracking-widest text-white/40">
              {queueLabel}
            </span>
          </div>
        )}
      </div>

      {/* Botão de navegação */}
      <Link href={`/campanhas/${campaign.id}`} passHref>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 rounded-lg flex-shrink-0 hover:bg-kinetic-orange hover:text-white transition-all"
        >
          <ArrowRight size={14} />
        </Button>
      </Link>
    </div>
  );
}

interface AutomationCampaignSectionProps {
  campaigns: Campaign[];
  isLoading: boolean;
}

export function AutomationCampaignSection({ campaigns, isLoading }: AutomationCampaignSectionProps) {
  if (isLoading) {
    return (
      <TactileCard className="p-8 flex items-center justify-center border-none">
        <div className="flex flex-col items-center gap-3">
          <Clock className="animate-spin text-kinetic-orange/40" size={24} />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Rastreando Lotes de Disparo...</p>
        </div>
      </TactileCard>
    );
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <TactileCard className="p-12 flex flex-col items-center justify-center border-none bg-white/[0.02]">
        <Zap className="text-white/5 mb-4" size={32} />
        <p className="text-xs font-bold uppercase tracking-widest text-white/20">Nenhuma campanha gerada por esta esteira ainda</p>
        <p className="text-[9px] font-medium text-white/10 uppercase mt-2">Os disparos aparecerão aqui conforme links forem capturados</p>
      </TactileCard>
    );
  }

  const sortedCampaigns = [...campaigns].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-sm font-black italic text-white/80 uppercase tracking-widest flex items-center gap-2">
          <Zap size={14} className="text-kinetic-orange" />
          Últimas Campanhas Desta Esteira
        </h3>
        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-white/5 bg-white/5">
          {campaigns.length} Registradas
        </Badge>
      </div>

      <TactileCard className="overflow-hidden p-0 border-none bg-anthracite-surface/50">
        <div className="flex flex-col">
          {sortedCampaigns.slice(0, 10).map((campaign) => (
            <CampaignMiniCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      </TactileCard>
    </div>
  );
}
