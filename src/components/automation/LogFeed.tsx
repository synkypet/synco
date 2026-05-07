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
import { CheckCircle2, XCircle, AlertCircle, Search, ExternalLink, Info, RefreshCw, Zap, Tag, MapPin, Clock, Activity, TrendingUp } from 'lucide-react';
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
  sourceType?: string;
}

export function LogFeed({ logs, title, targetNames = {}, sourceType }: LogFeedProps) {
  const [selectedLog, setSelectedLog] = React.useState<any>(null);
  
  const isMonitor = sourceType === 'group_monitor';
  const IconHeader = isMonitor ? Activity : Search;

  // Status técnico interno do log de automação
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processing':
        return <Badge className="bg-blue-500/10 text-blue-500 border-none font-black text-[9px] uppercase tracking-widest gap-1"><RefreshCw size={10} className="animate-spin" /> Aguardando</Badge>;
      case 'processed':
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-none font-black text-[9px] uppercase tracking-widest gap-1"><CheckCircle2 size={10} /> Sucesso</Badge>;
      case 'captured':
        return <Badge className="bg-kinetic-orange/10 text-kinetic-orange border-none font-black text-[9px] uppercase tracking-widest gap-1"><Zap size={10} /> Capturado</Badge>;
      case 'finished':
        return <Badge className="bg-zinc-500/10 text-zinc-500 border-none font-black text-[9px] uppercase tracking-widest gap-1"><CheckCircle2 size={10} /> Finalizado</Badge>;
      case 'filtered':
        return <Badge className="bg-amber-500/10 text-amber-500 border-none font-black text-[9px] uppercase tracking-widest gap-1"><AlertCircle size={10} /> Pulado</Badge>;
      case 'error':
        return <Badge className="bg-red-500/10 text-red-500 border-none font-black text-[9px] uppercase tracking-widest gap-1"><XCircle size={10} /> Falha</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground border-none font-black text-[9px] uppercase tracking-widest">Iniciado</Badge>;
    }
  };

  // Status real de entrega vindo do send_job (espelhado de campanhas)
  const getDeliveryStatusBadge = (sendStatus: string | null) => {
    switch (sendStatus) {
      case 'pending':
        return <Badge className="bg-blue-500/10 text-blue-400 border-none font-black text-[9px] uppercase tracking-widest gap-1"><Clock size={10} /> Aguardando Envio</Badge>;
      case 'processing':
        return <Badge className="bg-kinetic-orange/10 text-kinetic-orange border-none font-black text-[9px] uppercase tracking-widest gap-1"><RefreshCw size={10} className="animate-spin" /> Processando</Badge>;
      case 'sent':
      case 'completed':
        return <Badge className="bg-emerald-500/10 text-emerald-400 border-none font-black text-[9px] uppercase tracking-widest gap-1"><CheckCircle2 size={10} /> Enviado</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/10 text-red-400 border-none font-black text-[9px] uppercase tracking-widest gap-1"><AlertCircle size={10} /> Falhou</Badge>;
      default: return null;
    }
  };

  const getEventDescription = (log: any) => {
    const { event_type, details } = log;
    switch (event_type) {
      case 'radar_discovery': return details?.message || 'Procurando novos produtos...';
      case 'radar_dispatch': return 'Produto preparado para envio';
      case 'job_created': 
        return (
          <span className="flex items-center gap-1">
            Pronto para ser enviado
            <Link 
              href={`/campanhas/${details.campaignId}`}
              className="text-kinetic-orange hover:underline font-mono"
            >
              (Ver Detalhes)
            </Link>
          </span>
        );
      case 'no_routes': return 'Nenhum lugar definido para enviar';
      case 'ingest_dedupe': return 'Este produto já foi visto antes';
      case 'dest_dedupe': return 'Já enviamos este produto para este grupo';
      case 'rule_rejected': return 'Não atende aos seus filtros (preço ou comissão)';
      case 'anti_loop': return 'Evitando enviar para o mesmo grupo de origem';
      case 'fetch_failed': return 'Não conseguimos ler as informações do produto';
      case 'operational_lock': return 'Aguardando tempo de segurança para o próximo envio';
      default: return event_type;
    }
  };

  const dispatchLogs = logs.filter(l => l.event_type === 'radar_dispatch' && l._product);
  const techLogs = logs.filter(l => l.event_type !== 'radar_dispatch' || !l._product);

  return (
    <div className="space-y-6">

      {dispatchLogs.length > 0 && (
        <TactileCard className="overflow-hidden">
          <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-500" />
              Últimos Produtos Encaminhados
            </h3>
            <span className="text-[9px] text-white/20 font-black uppercase tracking-widest">{dispatchLogs.length} sucessos</span>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {dispatchLogs.map((log) => {
              const p = log._product;
              const destName = targetNames[log.details?.routeId] || 'Destino';
              const score = p?.opportunity_score || 0;
              const marketplace = p?.marketplace || 'Shopee';

              return (
                <div
                  key={log.id}
                  className="flex items-start gap-5 p-5 hover:bg-white/[0.03] transition-all group cursor-pointer border-l-2 border-transparent hover:border-kinetic-orange/40"
                  onClick={() => setSelectedLog(log)}
                >
                  {/* Thumbnail com Badges de Radar */}
                  <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-deep-void shadow-skeuo-pressed flex-shrink-0">
                    {p?.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/10">
                        <Tag size={24} />
                      </div>
                    )}
                    
                    {/* Discount Overlay */}
                    {p?.discount_percent > 0 && (
                      <div className="absolute top-1.5 left-1.5 bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg uppercase tracking-tighter">
                        -{p.discount_percent}%
                      </div>
                    )}

                    {/* Score Overlay */}
                    <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/10">
                       <span className={`text-[8px] font-black ${score >= 90 ? 'text-kinetic-orange' : 'text-white/60'}`}>{score}</span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-4">
                       <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${marketplace === 'Shopee' ? 'bg-orange-500' : 'bg-blue-500'} animate-pulse`} />
                          <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.2em]">{marketplace}</span>
                          <span className="text-[8px] font-black text-emerald-500/60 uppercase tracking-widest bg-emerald-500/5 px-1.5 py-0.5 rounded">Factual</span>
                       </div>
                       <span className="text-[8px] text-white/10 font-mono uppercase tracking-widest whitespace-nowrap">
                        há {formatDistanceToNow(new Date(log.created_at), { locale: ptBR })}
                      </span>
                    </div>

                    <p className="text-[11px] font-bold text-white/90 line-clamp-1 leading-tight group-hover:text-white transition-colors">
                      {p?.name || 'Produto Monitorado'}
                    </p>

                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex flex-col">
                         <span className="text-[7px] font-black text-white/20 uppercase tracking-widest">Preço</span>
                         <span className="text-[11px] font-black text-white/80">R$ {(log.details?.factualPrice ?? p?.current_price ?? 0).toFixed(2)}</span>
                      </div>
                      
                      <div className="flex flex-col">
                         <span className="text-[7px] font-black text-white/20 uppercase tracking-widest">Ganha</span>
                         <span className="text-[11px] font-black text-kinetic-orange">
                            {p?.commission_percent}% · R$ {p?.commission_value?.toFixed(2)}
                         </span>
                      </div>

                      {p?.sales_count > 0 && (
                        <div className="flex flex-col">
                          <span className="text-[7px] font-black text-white/20 uppercase tracking-widest">Vendas</span>
                          <div className="flex items-center gap-1">
                            <TrendingUp size={10} className="text-emerald-500" />
                            <span className="text-[10px] font-black text-white/60">{p.sales_count.toLocaleString('pt-BR')}+</span>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col ml-auto text-right">
                         <span className="text-[7px] font-black text-white/20 uppercase tracking-widest mb-1">Destino de Envio</span>
                         <div className="flex items-center gap-1.5 justify-end">
                            <MapPin size={10} className="text-white/20" />
                            <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest truncate max-w-[120px]">{destName}</span>
                         </div>
                      </div>
                    </div>
                  </div>

                  {/* Ações / Status Delivery */}
                  <div className="flex flex-col items-end gap-3 flex-shrink-0 pt-1">
                    {getDeliveryStatusBadge(log._sendStatus)}
                    <div className="flex items-center gap-2">
                       {p?.original_url && (
                        <a
                          href={p.original_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-white/20 hover:text-kinetic-orange hover:bg-kinetic-orange/10 transition-all"
                          title="Ver no Marketplace"
                        >
                          <ExternalLink size={12} />
                        </a>
                      )}
                      <button className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-white/20 hover:text-white transition-all">
                        <Info size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </TactileCard>
      )}

      <TactileCard className="overflow-hidden">
        <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 flex items-center gap-2">
            <IconHeader size={14} className="text-kinetic-orange" />
            {title || 'O que o sistema está fazendo agora'}
          </h3>
          <span className="text-[9px] opacity-50 font-mono italic">Atualiza sozinho</span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-white/5 border-none hover:bg-transparent">
                <TableHead className="text-[9px] font-black uppercase tracking-widest text-white/30 h-10 px-4">Horário</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-widest text-white/30 h-10 px-4 w-1/3">O que foi encontrado?</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-widest text-white/30 h-10 px-4">Resultado</TableHead>
                <TableHead className="text-[9px] font-black uppercase tracking-widest text-white/30 h-10 px-4">O que aconteceu?</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {techLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic text-[10px] uppercase tracking-widest">
                    Aguardando as primeiras atividades...
                  </TableCell>
                </TableRow>
              ) : (
                techLogs.map((log) => (
                  <TableRow 
                    key={log.id} 
                    className="border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell className="p-4 text-[10px] font-mono text-white/40">
                      {format(new Date(log.created_at), 'HH:mm:ss')}
                    </TableCell>
                    <TableCell className="p-4">
                      <div className="flex items-center gap-2 max-w-xs">
                        {log.event_type === 'radar_discovery' ? (
                           <Search size={10} className="text-kinetic-orange" />
                        ) : (
                           <Activity size={10} className="text-white/20" />
                        )}
                        <span className="text-[10px] font-mono opacity-80 truncate" title={log.details?.url}>
                          {log.details?.url || 'N/A'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="p-4">
                      {getStatusBadge(log.status)}
                    </TableCell>
                    <TableCell className="p-4 text-[10px] font-bold text-white/60">
                      {getEventDescription(log)}
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
