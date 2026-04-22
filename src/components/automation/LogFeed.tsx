// src/components/automation/LogFeed.tsx
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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, XCircle, AlertCircle, Search, ExternalLink, Info } from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';

interface LogFeedProps {
  logs: any[];
  title?: string;
}

export function LogFeed({ logs, title }: LogFeedProps) {
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

  const getEventDescription = (log: any) => {
    const { event_type, details } = log;
    switch (event_type) {
      case 'radar_discovery': return details?.message || 'Busca autônoma realizada';
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

  const [selectedLog, setSelectedLog] = React.useState<any>(null);

  return (
    <TactileCard className="overflow-hidden">
      <div className="p-4 border-b border-white/5 bg-white/20 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
          <Search size={16} className="text-kinetic-orange" />
          {title || 'Observabilidade Operacional'}
        </h3>
        <span className="text-[10px] opacity-50 font-mono italic">Atualiza automaticamente</span>
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
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic text-sm">
                  Nenhuma atividade registrada ainda.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
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
                  <TableCell className="text-[11px] font-bold flex items-center justify-between">
                    <span className={log.status === 'filtered' ? 'text-yellow-500/80 mr-2' : log.status === 'processing' ? 'text-blue-400 mr-2' : 'text-white/70 mr-2'}>
                      {getEventDescription(log)}
                    </span>
                    <Info size={12} className="opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

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
              <div className="bg-deep-void p-4 rounded-2xl border border-white/5 shadow-skeuo-pressed">
                <p className="text-[10px] font-black uppercase text-white/20 mb-2 tracking-widest">Resumo Operacional</p>
                <p className="text-sm font-bold text-white/90 italic leading-relaxed">
                  {getEventDescription(selectedLog)}
                </p>
              </div>

              {selectedLog.details?.capturedItems && selectedLog.details.capturedItems.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase text-white/20 tracking-widest flex items-center justify-between">
                    Itens Capturados na Shopee
                    <span className="text-kinetic-orange">{selectedLog.details.capturedItems.length} Encontrados</span>
                  </p>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto px-1 custom-scrollbar">
                    {selectedLog.details.capturedItems.map((item: any, idx: number) => (
                      <div key={idx} className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-center justify-between group/item hover:bg-white/10 transition-all">
                        <div className="flex flex-col gap-0.5 overflow-hidden">
                          <p className="text-[11px] font-bold text-white/90 truncate pr-4">{item.name}</p>
                          <p className="text-[10px] text-green-500 font-black">R$ {item.price?.toFixed(2)}</p>
                        </div>
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="h-8 w-8 rounded-lg bg-deep-void flex items-center justify-center text-kinetic-orange opacity-40 group-hover/item:opacity-100 transition-opacity hover:shadow-glow-orange"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!selectedLog.details?.capturedItems && (
                <div className="space-y-3">
                   <p className="text-[10px] font-black uppercase text-white/20 tracking-widest">Metadados Técnicos</p>
                   <div className="bg-black/40 p-4 rounded-xl border border-white/5 overflow-x-auto">
                      <pre className="text-[10px] font-mono text-kinetic-orange/80 whitespace-pre-wrap">
                        {JSON.stringify(selectedLog.details, null, 2)}
                      </pre>
                   </div>
                </div>
              )}

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
    </TactileCard>
  );
}
