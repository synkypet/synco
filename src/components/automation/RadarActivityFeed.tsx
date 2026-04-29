'use client';

import React, { useEffect, useState } from 'react';
import { 
  CheckCircle2, 
  Send, 
  TrendingDown, 
  XCircle, 
  Copy, 
  Clock, 
  Search, 
  Layers, 
  Zap,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TactileCard } from '@/components/ui/TactileCard';

interface RadarEvent {
  event_type: string;
  product_title: string;
  keyword: string;
  score: number;
  commission_value: number;
  discard_reason: string;
  created_at: string;
  campaign_id?: string;
}

interface RadarActivityData {
  status: 'active' | 'cooldown' | 'awaiting_restock';
  next_keyword: string;
  discovery_page: number;
  last_run_at: string;
  events: RadarEvent[];
}

export function RadarActivityFeed({ sourceId }: { sourceId: string }) {
  const [data, setData] = useState<RadarActivityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivity() {
      try {
        const res = await fetch(`/api/automation/sources/${sourceId}/activity`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error('Failed to fetch radar activity:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchActivity();
  }, [sourceId]);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin text-kinetic-orange" size={24} />
      </div>
    );
  }

  if (!data) return null;

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'active':
        return { label: 'Operando', color: 'text-green-500', glow: 'shadow-glow-green' };
      case 'cooldown':
        return { label: 'Aguardando Cooldown', color: 'text-blue-400', glow: 'shadow-glow-blue' };
      case 'awaiting_restock':
        return { label: 'Necessita Reposição', color: 'text-orange-500', glow: 'shadow-glow-orange' };
      default:
        return { label: 'Desconhecido', color: 'text-gray-500', glow: '' };
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'discovered': return <CheckCircle2 size={14} className="text-green-500" />;
      case 'dispatched': return <Send size={14} className="text-blue-400" />;
      case 'skipped_score': return <TrendingDown size={14} className="text-yellow-500" />;
      case 'skipped_match': return <XCircle size={14} className="text-white/40" />;
      case 'skipped_dedupe': return <Copy size={14} className="text-red-500" />;
      case 'skipped_pacing': return <Clock size={14} className="text-orange-500" />;
      default: return <Zap size={14} className="text-gray-400" />;
    }
  };

  const statusInfo = getStatusInfo(data.status);

  return (
    <div className="space-y-6">
      {/* Strategic Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TactileCard className="p-4 flex flex-col gap-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Estado do Radar</span>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full bg-current ${statusInfo.color} animate-pulse shadow-glow`} />
            <span className={`text-xs font-bold uppercase tracking-wider ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
        </TactileCard>

        <TactileCard className="p-4 flex flex-col gap-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Próxima Keyword</span>
          <div className="flex items-center gap-2">
            <Search size={14} className="text-kinetic-orange" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              {data.next_keyword}
            </span>
          </div>
        </TactileCard>

        <TactileCard className="p-4 flex flex-col gap-2">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Página Shopee</span>
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-kinetic-orange" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              {data.discovery_page}
            </span>
          </div>
        </TactileCard>
      </div>

      {/* Activity List */}
      <TactileCard className="overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Últimas Atividades de Descoberta</h4>
          {data.last_run_at && (
            <span className="text-[9px] text-white/20 font-medium">
              Último restock: {formatDistanceToNow(new Date(data.last_run_at), { addSuffix: true, locale: ptBR })}
            </span>
          )}
        </div>

        <div className="divide-y divide-white/[0.03] max-h-[400px] overflow-y-auto custom-scrollbar">
          {data.events.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/10 italic">Nenhum evento registrado no log.</p>
            </div>
          ) : (
            data.events.map((event, idx) => (
              <div key={idx} className="p-4 hover:bg-white/[0.01] transition-colors flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    {getEventIcon(event.event_type)}
                  </div>
                  
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-white/90 truncate">
                        {event.product_title}
                      </span>
                      {event.campaign_id && (
                        <a 
                          href={`/campanhas/${event.campaign_id}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-kinetic-orange hover:text-white transition-colors"
                        >
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[9px] font-medium text-white/30 uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <Search size={8} /> {event.keyword}
                      </span>
                      {event.score && (
                        <span>Score: {event.score}</span>
                      )}
                      {event.discard_reason && (
                        <span className="text-red-400/50 italic">{event.discard_reason}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-[9px] font-bold text-white/10 whitespace-nowrap">
                  {formatDistanceToNow(new Date(event.created_at), { addSuffix: false, locale: ptBR })}
                </div>
              </div>
            ))
          )}
        </div>
      </TactileCard>
    </div>
  );
}
