import React, { useState } from 'react';
import { Drawer } from 'vaul';
import { Campaign, CampaignStatus } from '@/types/campaign';
import { useCampaignStats, useCampaignJobs, useCancelPending } from '@/hooks/use-campaigns';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  X, 
  SendHorizonal, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FileText, 
  LayoutList, 
  Package, 
  ChevronLeft, 
  ChevronRight,
  ExternalLink,
  ArrowRight,
  Loader2,
  Ban
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CampaignDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign | null;
}

const STATUS_BADGES: Record<string, any> = {
  sent: { label: 'Enviado', color: 'bg-emerald-500/10 text-emerald-500' },
  completed: { label: 'Concluído', color: 'bg-emerald-500/10 text-emerald-500' },
  pending: { label: 'Pendente', color: 'bg-blue-500/10 text-blue-400' },
  processing: { label: 'Processando', color: 'bg-blue-500/10 text-blue-400 animate-pulse' },
  failed: { label: 'Falhou', color: 'bg-red-500/10 text-red-500' },
  cancelled: { label: 'Cancelado', color: 'bg-white/10 text-white/40' },
};

export function CampaignDetailsDrawer({ isOpen, onClose, campaign }: CampaignDetailsDrawerProps) {
  const [page, setPage] = useState(1);
  const { data: stats } = useCampaignStats(campaign?.id);
  const { data: jobsData, isLoading: loadingJobs } = useCampaignJobs(campaign?.id, page);
  const cancelPending = useCancelPending();

  const hasPending = (stats?.pending ?? 0) > 0;

  if (!campaign) return null;

  return (
    <Drawer.Root open={isOpen} onOpenChange={onClose} direction="right">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" />
        <Drawer.Content className="bg-deep-void h-full fixed top-0 right-0 w-full sm:w-[500px] z-[101] shadow-skeuo-elevated flex flex-col border-l border-white/5 outline-none animate-in slide-in-from-right duration-500">
           {/* Header */}
           <div className="p-6 border-b border-white/5 bg-gradient-to-br from-white/5 to-transparent flex-shrink-0">
              <div className="flex items-center justify-between mb-6">
                <button onClick={onClose} className="p-2 -ml-2 rounded-lg text-white/20 hover:text-white transition-colors">
                  <X size={20} />
                </button>
                <div className="flex items-center gap-2">
                   <Badge variant="outline" className="h-6 text-[9px] font-black uppercase tracking-widest bg-white/5 border-none">
                      ID: {campaign.id.split('-')[0]}
                   </Badge>
                </div>
              </div>

              <div className="flex items-start gap-4">
                 {campaign.items && campaign.items.length === 1 && (
                   <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/40 border border-white/5 shadow-skeuo-pressed shrink-0">
                     {campaign.items[0].image_url ? (
                       <img src={campaign.items[0].image_url} alt="" className="w-full h-full object-cover" />
                     ) : (
                       <Package size={20} className="w-full h-full p-4 text-white/10" />
                     )}
                   </div>
                 )}
                 <div className="flex flex-col gap-1 min-w-0">
                    <h2 className="text-xl font-black uppercase tracking-tight font-headline text-white line-clamp-2 leading-tight">{campaign.name || 'Envio Rápido'}</h2>
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest px-1">
                      {new Date(campaign.created_at || '').toLocaleString()}
                    </p>
                 </div>
              </div>

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-4 gap-3 mt-8">
                 <div className="bg-deep-void/50 p-4 rounded-xl shadow-skeuo-pressed border border-white/5 flex flex-col gap-1 items-center">
                    <span className="text-lg font-black text-white">{stats?.total || 0}</span>
                    <span className="text-[7px] font-black uppercase text-white/20 tracking-tighter">Eventos</span>
                 </div>
                 <div className="bg-deep-void/50 p-4 rounded-xl shadow-skeuo-pressed border border-white/5 flex flex-col gap-1 items-center">
                    <span className="text-lg font-black text-emerald-500">{stats?.completed || 0}</span>
                    <span className="text-[7px] font-black uppercase text-white/20 tracking-tighter">Sucesso</span>
                 </div>
                 <div className="bg-deep-void/50 p-4 rounded-xl shadow-skeuo-pressed border border-white/5 flex flex-col gap-1 items-center">
                    <span className="text-lg font-black text-blue-400">{stats?.pending || 0}</span>
                    <span className="text-[7px] font-black uppercase text-white/20 tracking-tighter">Pendentes</span>
                 </div>
                 <div className="bg-deep-void/50 p-4 rounded-xl shadow-skeuo-pressed border border-white/5 flex flex-col gap-1 items-center">
                    <span className="text-lg font-black text-red-500">{stats?.failed || 0}</span>
                    <span className="text-[7px] font-black uppercase text-white/20 tracking-tighter">Erros</span>
                 </div>
              </div>

              {/* Cancel Pending Action */}
              {hasPending && (
                <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/60">{stats?.pending} job(s) na fila</span>
                    <span className="text-[8px] font-bold text-white/20">Cancele para evitar envios não desejados</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => cancelPending.mutate(campaign.id)}
                    disabled={cancelPending.isPending}
                    className="h-8 gap-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-[8px] font-black uppercase tracking-widest border-none"
                  >
                    {cancelPending.isPending ? <Loader2 size={10} className="animate-spin" /> : <Ban size={10} />}
                    Cancelar Pendências
                  </Button>
                </div>
              )}
           </div>

           {/* Content */}
           <div className="flex-1 overflow-hidden">
             <Tabs defaultValue="monitor" className="h-full flex flex-col">
               <TabsList className="px-6 py-2 bg-black/20 border-b border-white/5 h-12 w-full justify-start rounded-none">
                  <TabsTrigger value="monitor" className="text-[9px] font-black uppercase tracking-widest gap-2">
                    <LayoutList size={12} />
                    Logs de Envio
                  </TabsTrigger>
                  <TabsTrigger value="items" className="text-[9px] font-black uppercase tracking-widest gap-2">
                    <Package size={12} />
                    Produtos
                  </TabsTrigger>
                  <TabsTrigger value="dests" className="text-[9px] font-black uppercase tracking-widest gap-2">
                    <ArrowRight size={12} />
                    Destinos
                  </TabsTrigger>
               </TabsList>

               <TabsContent value="monitor" className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  <div className="flex items-center justify-between mb-4">
                     <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Auditoria Operacional</span>
                     {jobsData && (
                        <div className="flex items-center gap-2">
                           <button 
                             disabled={page === 1}
                             onClick={() => setPage(p => Math.max(1, p - 1))}
                             className="p-1.5 rounded-lg text-white/20 hover:text-white disabled:opacity-30"
                           >
                             <ChevronLeft size={16} />
                           </button>
                           <span className="text-[10px] font-mono text-white/40">{page} / {jobsData.totalPages}</span>
                           <button 
                             disabled={page === jobsData.totalPages}
                             onClick={() => setPage(p => Math.min(jobsData.totalPages, p + 1))}
                             className="p-1.5 rounded-lg text-white/20 hover:text-white disabled:opacity-30"
                           >
                             <ChevronRight size={16} />
                           </button>
                        </div>
                     )}
                  </div>

                  {loadingJobs ? (
                    <div className="flex flex-col items-center py-20 gap-4 opacity-20">
                      <Loader2 className="w-8 h-8 animate-spin text-kinetic-orange" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Acessando audit logs...</span>
                    </div>
                  ) : jobsData?.jobs.map((job: any) => (
                    <div key={job.id} className="p-4 rounded-xl bg-white/5 border border-white/5 shadow-skeuo-flat space-y-3 group hover:border-kinetic-orange/20 transition-all">
                       <div className="flex items-start justify-between gap-4">
                         <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-white/80 line-clamp-1">{job.destination_name || 'Destinatário'}</span>
                            <span className="text-[8px] font-mono font-bold text-white/20">{job.destination}</span>
                         </div>
                         <Badge className={cn("text-[8px] font-black uppercase tracking-widest border-none shrink-0", STATUS_BADGES[job.status]?.color)}>
                           {STATUS_BADGES[job.status]?.label}
                         </Badge>
                       </div>
                       
                       <p className="text-[10px] font-bold text-white/40 italic leading-relaxed line-clamp-2">
                         "{job.message_body}"
                       </p>

                       {job.last_error && (
                         <div className="flex items-center gap-2 p-2 bg-red-500/10 rounded-lg">
                            <AlertCircle size={10} className="text-red-500 flex-shrink-0" />
                            <span className="text-[8px] font-black uppercase text-red-500 line-clamp-1">{job.last_error}</span>
                         </div>
                       )}

                       <div className="flex items-center justify-between pt-2">
                          <span className="text-[8px] font-black uppercase text-white/10">{job.session_id}</span>
                          <span className="text-[8px] font-mono text-white/20">
                            {job.processed_at ? new Date(job.processed_at).toLocaleTimeString() : '--:--'}
                          </span>
                       </div>
                    </div>
                  ))}
               </TabsContent>

               <TabsContent value="items" className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {campaign.items?.map((item: any) => (
                    <div key={item.id} className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center gap-4">
                       <div className="w-12 h-12 rounded-lg overflow-hidden bg-black/20 flex-shrink-0 border border-white/5 shadow-skeuo-pressed">
                          {item.image_url ? (
                            <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Package size={20} className="w-full h-full p-3 text-white/20" />
                          )}
                       </div>
                       <div className="flex-1 min-w-0">
                          <h4 className="text-[10px] font-black uppercase text-white/90 line-clamp-1">{item.product_name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                             <a href={item.affiliate_url} target="_blank" className="flex items-center gap-1 text-[8px] font-black uppercase text-kinetic-orange hover:underline">
                               Ver Link <ExternalLink size={8} />
                             </a>
                          </div>
                       </div>
                    </div>
                  ))}
               </TabsContent>

               <TabsContent value="dests" className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  {campaign.destinations?.map((dest: any) => (
                    <div key={dest.id} className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <LayoutList size={14} className="text-blue-400" />
                          </div>
                          <div className="flex flex-col">
                             <span className="text-[10px] font-black uppercase text-white/80">{dest.destination_type === 'group' ? 'Grupo' : 'Lista'}</span>
                             <span className="text-[8px] font-bold text-white/20 uppercase">Sincronização Ativa</span>
                          </div>
                       </div>
                       <Badge variant="outline" className="text-[8px] border-white/10 uppercase font-black text-white/20">
                         {dest.destination_id.split('-')[0]}
                       </Badge>
                    </div>
                  ))}
               </TabsContent>
             </Tabs>
           </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
