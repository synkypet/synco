// src/components/automation/LogFeed.tsx
'use client';
import React from 'react';
import { TactileCard } from '@/components/ui/TactileCard';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, XCircle, AlertCircle, Search, ExternalLink, Info, RefreshCw, Zap, Tag, MapPin } from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface LogFeedProps {
  logs: any[];
  title?: string;
  targetNames?: Record<string, string>;
}

export function LogFeed({ logs, title, targetNames = {} }: LogFeedProps) {
  const [selectedLog, setSelectedLog] = React.useState<any>(null);

  // Status técnico interno do log de automação
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processing':
        return <Badge className="bg-blue-500/10 text-blue-500 border-none font-black text-[9px] uppercase tracking-widest gap-1"><RefreshCw size={10} className="animate-spin" /> Processando</Badge>;
      case 'processed':
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-none font-black text-[9px] uppercase tracking-widest gap-1"><CheckCircle2 size={10} /> Enviado</Badge>;
      case 'captured':
        return <Badge className="bg-kinetic-orange/10 text-kinetic-orange border-none font-black text-[9px] uppercase tracking-widest gap-1"><Zap size={10} /> Capturado</Badge>;
      case 'finished':
        return <Badge className="bg-zinc-500/10 text-zinc-500 border-none font-black text-[9px] uppercase tracking-widest gap-1"><CheckCircle2 size={10} /> Finalizado</Badge>;
      case 'filtered':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-none font-black text-[9px] uppercase tracking-widest gap-1"><XCircle size={10} /> Filtrado</Badge>;
      case 'error':
        return <Badge className="bg-red-500/10 text-red-500 border-none font-black text-[9px] uppercase tracking-widest gap-1"><AlertCircle size={10} /> Erro</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground border-none font-black text-[9px] uppercase tracking-widest">Iniciado</Badge>;
    }
  };

  // Status real de entrega vindo do send_job (espelhado de campanhas)
  const getDeliveryStatusBadge = (sendStatus: string | null) => {
    switch (sendStatus) {
      case 'pending':
        return <Badge className="bg-zinc-500/10 text-zinc-400 border-none font-black text-[9px] uppercase tracking-widest gap-1"><RefreshCw size={10} /> Na Fila</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500/10 text-blue-400 border-none font-black text-[9px] uppercase tracking-widest gap-1"><RefreshCw size={10} className="animate-spin" /> Enviando</Badge>;
      case 'sent':
      case 'completed':
        return <Badge className="bg-emerald-500/10 text-emerald-400 border-none font-black text-[9px] uppercase tracking-widest gap-1"><CheckCircle2 size={10} /> Enviado</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/10 text-red-400 border-none font-black text-[9px] uppercase tracking-widest gap-1"><AlertCircle size={10} /> Falhou</Badge>;
      case 'session_lost':
        return <Badge className="bg-yellow-500/10 text-yellow-400 border-none font-black text-[9px] uppercase tracking-widest gap-1"><AlertCircle size={10} /> Sessão Perdida</Badge>;
      case 'cancelled':
        return <Badge className="bg-zinc-600/10 text-zinc-500 border-none font-black text-[9px] uppercase tracking-widest gap-1"><XCircle size={10} /> Cancelado</Badge>;
      default:
        // Sem send_job ainda: produto foi descoberto mas ainda aguarda criação da campanha
        return <Badge className="bg-zinc-700/20 text-zinc-500 border-none font-black text-[9px] uppercase tracking-widest gap-1"><Zap size={10} /> Descoberto</Badge>;
    }
  };

  const getEventDescription = (log: any) => {
    const { event_type, details } = log;
    switch (event_type) {
      case 'radar_discovery': return details?.message || 'Busca autônoma realizada';
      case 'radar_dispatch': return 'Produto enviado para o grupo';
      case 'job_created': 
        return (
          <span className="flex items-center gap-1">
            Job criado com sucesso 
            <Link 
              href={`/campanhas/${details.campaignId}`}
              className="text-kinetic-orange hover:underline font-mono"
            >
              ({details.campaignId?.substring(0, 8)})
            </Link>
          </span>
        );
      case 'no_routes': return 'Nenhuma rota de destino configurada';
      case 'ingest_dedupe': return 'Link já processado recentemente (Dedupe Camada 1)';
      case 'dest_dedupe': return 'Link já enviado para este destino (Dedupe Camada 2)';
      case 'rule_rejected': return 'Rejeitado por filtros (Preço/Comissão/Keyword)';
      case 'anti_loop': return 'Bloqueado: Origem coincide com Destino';
      case 'fetch_failed': return 'Falha ao buscar metadados do produto';
      default: return event_type;
    }
  };

  // Separar logs de dispatch (com produto enriquecido) de logs técnicos
  const dispatchLogs = logs.filter(l => l.event_type === 'radar_dispatch' && l._product);
  const techLogs = logs.filter(l => l.event_type !== 'radar_dispatch' || !l._product);

  return (
    <div className="space-y-6">

      {/* SEÇÃO 1: PRODUTOS ENVIADOS — Cards Ricos */}
      {dispatchLogs.length > 0 && (
        <TactileCard className="overflow-hidden">
          <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-500" />
              Produtos Enviados
            </h3>
            <span className="text-[9px] text-white/20 font-black uppercase tracking-widest">{dispatchLogs.length} envios</span>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {dispatchLogs.map((log) => {
              const p = log._product;
              const destName = targetNames[log.details?.routeId] || 'Destino';
              return (
                <div
                  key={log.id}
                  className="flex items-center gap-4 p-4 hover:bg-white/[0.03] transition-colors group cursor-pointer"
                  onClick={() => setSelectedLog(log)}
                >
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/5 border border-white/5 flex-shrink-0 shadow-skeuo-flat">
                    {p?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/10">
                        <Tag size={20} />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-[11px] font-bold text-white/90 line-clamp-2 leading-tight">
                      {p?.name || 'Produto'}
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[10px] font-black text-emerald-400">
                        R$ {(log.details?.factualPrice ?? p?.current_price ?? 0).toFixed(2)}
                      </span>
                      {p?.discount_percent > 0 && (
                        <span className="text-[9px] font-black text-white/30">
                          -{p.discount_percent}% desc.
                        </span>
                      )}
                      {p?.commission_value && (
                        <span className="text-[9px] font-black text-kinetic-orange/70 uppercase tracking-wide">
                          Comis: R$ {p.commission_value.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={9} className="text-white/20 flex-shrink-0" />
                      <span className="text-[9px] font-bold text-white/20 uppercase tracking-wider truncate">{destName}</span>
                      <span className="text-[8px] text-white/10 font-mono ml-auto flex-shrink-0">
                        {formatDistanceToNow(new Date(log.created_at), { locale: ptBR, addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  {/* Status real de entrega + Link Externo */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {getDeliveryStatusBadge(log._sendStatus)}
                    {p?.original_url && (
                      <a
                        href={p.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-white/20 hover:text-kinetic-orange transition-colors"
                        title="Ver no Shopee"
                      >
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TactileCard>
      )}

      {/* SEÇÃO 2: ATIVIDADE TÉCNICA — Tabela Compacta */}
      <TactileCard className="overflow-hidden">
        <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 flex items-center gap-2">
            <Search size={14} className="text-kinetic-orange" />
            {title || 'Atividade Técnica do Sistema'}
          </h3>
          <span className="text-[9px] opacity-50 font-mono italic">Atualiza automaticamente</span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-white/5 border-none hover:bg-transparent">
                <TableHead className="text-[10px] font-bold uppercase py-2">Hora</TableHead>
                <TableHead className="text-[10px] font-bold uppercase py-2 w-1/3">Link / Busca</TableHead>
                <TableHead className="text-[10px] font-bold uppercase py-2">Status</TableHead>
                <TableHead className="text-[10px] font-bold uppercase py-2">Decisão / Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {techLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic text-sm">
                    Nenhuma atividade registrada ainda.
                  </TableCell>
                </TableRow>
              ) : (
                techLogs.map((log) => (
                  <TableRow 
                    key={log.id} 
                    className="hover:bg-white/5 transition-colors border-white/5 cursor-pointer group"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell className="text-[10px] opacity-50 font-mono">
                      {format(new Date(log.created_at), 'HH:mm:ss', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-mono opacity-80 truncate" title={log.details?.url}>
                          {log.details?.url || 'N/A'}
                        </span>
                        {log.details?.keyword && (
                          <span className="text-[8px] font-black uppercase text-kinetic-orange/60 tracking-wider">Shopee Discovery</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(log.status)}
                    </TableCell>
                    <TableCell className="text-[11px] font-bold">
                      <div className="flex items-center justify-between gap-2">
                        <span className={log.status === 'filtered' ? 'text-yellow-500/80' : log.status === 'processing' ? 'text-blue-400' : 'text-white/70'}>
                          {getEventDescription(log)}
                        </span>
                        <Info size={12} className="opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </TactileCard>

      {/* Modal de Auditoria Detalhada */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="bg-anthracite-surface border-white/5 shadow-skeuo-elevated text-white max-w-lg max-h-[80vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-[0.2em] font-black text-xs text-kinetic-orange mb-2">Auditoria de Execução</DialogTitle>
            <DialogDescription className="text-zinc-500 text-[11px] font-medium uppercase tracking-widest">
              RAIO-X DO EVENTO • {selectedLog && format(new Date(selectedLog.created_at), 'dd/MM HH:mm:ss')}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-6 mt-4">
              {/* Card do Produto se disponível */}
              {selectedLog._product && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                  {selectedLog._product.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedLog._product.image_url} alt="" className="w-14 h-14 rounded-lg object-cover bg-white/10 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-white/90 line-clamp-2">{selectedLog._product.name}</p>
                    <p className="text-[10px] text-emerald-400 font-black mt-0.5">
                      R$ {(selectedLog.details?.factualPrice ?? selectedLog._product.current_price ?? 0).toFixed(2)}
                    </p>
                  </div>
                  {selectedLog._product.original_url && (
                    <a
                      href={selectedLog._product.original_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/20 hover:text-kinetic-orange transition-colors"
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              )}

              <div className="bg-deep-void p-4 rounded-2xl border border-white/5 shadow-skeuo-pressed">
                <p className="text-[10px] font-black uppercase text-white/20 mb-2 tracking-widest">Resumo Operacional</p>
                <p className="text-sm font-bold text-white/90 italic leading-relaxed">
                  {getEventDescription(selectedLog)}
                </p>
              </div>

              <div className="space-y-3">
                 <p className="text-[10px] font-black uppercase text-white/20 tracking-widest">Metadados Técnicos</p>
                 <div className="bg-black/40 p-4 rounded-xl border border-white/5 overflow-x-auto">
                    <pre className="text-[10px] font-mono text-kinetic-orange/80 whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                 </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl border border-white/5">
                 <div className={`p-1.5 rounded-lg ${selectedLog.status === 'error' ? 'bg-red-500/20' : selectedLog.status === 'processing' ? 'bg-blue-500/20' : 'bg-emerald-500/20'}`}>
                    <AlertCircle size={14} className={selectedLog.status === 'error' ? 'text-red-500' : selectedLog.status === 'processing' ? 'text-blue-500' : 'text-emerald-500'} />
                 </div>
                 <div>
                    <p className="text-[10px] font-black uppercase text-white/40 tracking-tighter cursor-default">Status do Processamento</p>
                    <p className="text-xs font-bold uppercase tracking-widest">{selectedLog.status}</p>
                 </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
