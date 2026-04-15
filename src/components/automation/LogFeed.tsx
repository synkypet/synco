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
import { CheckCircle2, XCircle, AlertCircle, Search, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface LogFeedProps {
  logs: any[];
  title?: string;
}

export function LogFeed({ logs, title }: LogFeedProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processed':
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-none font-black text-[9px] uppercase tracking-widest gap-1"><CheckCircle2 size={10} /> Enviado</Badge>;
      case 'filtered':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-none font-black text-[9px] uppercase tracking-widest gap-1"><XCircle size={10} /> Filtrado</Badge>;
      case 'error':
        return <Badge className="bg-red-500/10 text-red-500 border-none font-black text-[9px] uppercase tracking-widest gap-1"><AlertCircle size={10} /> Erro</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground border-none font-black text-[9px] uppercase tracking-widest">Capturado</Badge>;
    }
  };

  const getEventDescription = (log: any) => {
    const { event_type, details } = log;
    switch (event_type) {
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
            <TableRow className="bg-white/5 border-none">
              <TableHead className="text-[10px] font-bold uppercase py-2">Data/Hora</TableHead>
              <TableHead className="text-[10px] font-bold uppercase py-2">Link Captado</TableHead>
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
                <TableRow key={log.id} className="hover:bg-white/5 transition-colors border-white/5">
                  <TableCell className="text-xs opacity-70">
                    {format(new Date(log.created_at), 'HH:mm:ss', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    <span className="text-[11px] font-mono opacity-80" title={log.details?.url}>
                       {log.details?.url || 'N/A'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(log.status)}
                  </TableCell>
                  <TableCell className="text-xs font-semibold">
                    <span className={log.status === 'filtered' ? 'text-yellow-500/80' : ''}>
                      {getEventDescription(log)}
                    </span>
                    {log.details?.campaignId && (
                      <ExternalLink size={10} className="inline ml-1 opacity-50 cursor-help" />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </TactileCard>
  );
}
