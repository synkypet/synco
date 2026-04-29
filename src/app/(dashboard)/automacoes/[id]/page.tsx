// src/app/(dashboard)/automacoes/[id]/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  useAutomationSource,
  useAutomationRoutes,
  useAutomationLogs,
  useAutomationRecentCampaigns,
  useUpdateAutomationSource,
  useUpsertAutomationRoute,
  useDeleteAutomationRoute,
  useDeleteAutomationSource
} from '@/hooks/use-automations';
import { useGroups } from '@/hooks/use-groups';
import { useDestinations } from '@/hooks/use-destinations';

import { OriginBlock } from '@/components/automation/OriginBlock';
import { InboundRuleManager } from '@/components/automation/InboundRuleManager';
import { TemplateBlock } from '@/components/automation/TemplateBlock';
import { DestinationBlock } from '@/components/automation/DestinationBlock';
import { DeliveryBanner } from '@/components/automation/DeliveryBanner';
import { LogFeed } from '@/components/automation/LogFeed';
import { AutomationStatusHeader } from '@/components/automation/AutomationStatusHeader';
import { ActiveFilterHUD } from '@/components/automation/ActiveFilterHUD';
import { AutomationAuditTrail } from '@/components/automation/AutomationAuditTrail';
import { RadarActivityFeed } from '@/components/automation/RadarActivityFeed';

import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Save, Zap, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function AutomationDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  // Queries
  const { data: source, isLoading: loadingSource } = useAutomationSource(id);
  const { data: routes, isLoading: loadingRoutes } = useAutomationRoutes(id);
  const { data: logs, isLoading: loadingLogs } = useAutomationLogs(id);
  const { data: recentCampaigns, isLoading: loadingRecent } = useAutomationRecentCampaigns(id);

  const { user } = useAuth();
  const { data: groups } = useGroups(user?.id as string);
  const { data: lists } = useDestinations(user?.id as string);

  // Mutations
  const updateSource = useUpdateAutomationSource();
  const upsertRoute = useUpsertAutomationRoute();
  const deleteRoute = useDeleteAutomationRoute();
  const deleteSource = useDeleteAutomationSource();

  // Local State for Rules & Template
  const [filters, setFilters] = useState<any>({});
  const [template, setTemplate] = useState<any>({});
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddRouteOpen, setIsAddRouteOpen] = useState(false);
  const [newRouteType, setNewRouteType] = useState<'group' | 'list'>('group');
  const [newRouteTargetId, setNewRouteTargetId] = useState('');

  // Sincronizar estado local com a primeira rota (Regras globais)
  useEffect(() => {
    if (routes && routes.length > 0) {
      setFilters(routes[0].filters || {});
      // Compatibilidade: mapear 'body' do banco para 'text' do componente se necessário, 
      // ou apenas passar o objeto. Vamos usar o objeto direto.
      setTemplate(routes[0].template_config || {});
    }
  }, [routes]);

  if (loadingSource || loadingRoutes) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="animate-spin text-kinetic-orange" size={40} />
        <p className="text-muted-foreground animate-pulse font-bold uppercase tracking-widest text-[10px]">Sincronizando Esteira Operacional...</p>
      </div>
    );
  }

  if (!source) return (
    <div className="p-20 text-center">
      <p className="font-black uppercase tracking-widest text-white/20">Automação não encontrada ou acesso negado.</p>
      <Button variant="link" onClick={() => router.push('/automacoes')} className="text-kinetic-orange mt-4 uppercase text-xs font-bold">Voltar ao Painel</Button>
    </div>
  );

  const handleSavePipeline = async () => {
    if (!routes || routes.length === 0) {
      toast.error("Adicione ao menos um destino antes de salvar as regras.");
      return;
    }

    setIsSaving(true);
    try {
      // Persistência Real: Aplicar regras e template para TODAS as rotas
      const promises = routes.map(route => upsertRoute.mutateAsync({
        ...route,
        filters,
        template_config: template
      }));

      await Promise.all(promises);
      toast.success('Configurações da esteira salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar pipeline:', error);
      toast.error('Falha na persistência. Verifique sua conexão.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSource = async () => {
    const promise = deleteSource.mutateAsync(id);

    toast.promise(promise, {
      loading: 'Excluindo esteira operacional...',
      success: () => {
        setIsDeleteOpen(false);
        router.push('/automacoes');
        return 'Automação removida com sucesso.';
      },
      error: 'Erro ao excluir a automação.'
    });
  };

  const handleAddRoute = () => {
    if (!newRouteTargetId) return;

    const promise = upsertRoute.mutateAsync({
      source_id: id,
      target_type: newRouteType,
      target_id: newRouteTargetId,
      is_active: true,
      filters,
      template_config: template
    });

    toast.promise(promise, {
      loading: 'Adicionando destino...',
      success: () => {
        setIsAddRouteOpen(false);
        setNewRouteTargetId('');
        return "Novo destino vinculado à esteira.";
      },
      error: "Erro ao vincular destino."
    });
  };

  const targetNames: Record<string, string> = {};
  routes?.forEach(r => {
    if (r.target_type === 'group') {
      targetNames[r.id] = groups?.find(g => g.id === r.target_id)?.name || 'Grupo de WhatsApp';
    } else {
      targetNames[r.id] = lists?.find(l => l.id === r.target_id)?.name || 'Lista de Destino';
    }
  });

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-32 animate-in fade-in duration-1000">
      {/* 0. Status & Strategic Header */}
      <AutomationStatusHeader 
        source={source} 
        onBack={() => router.push('/automacoes')} 
      />

      {/* Row 1: MOTOR (Discovery) + DESTINOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <OriginBlock
          source={source}
          sourceName={groups?.find(g => g.channel_id === source.channel_id && g.remote_id === source.external_group_id)?.name}
          onUpdate={(updates) => updateSource.mutate({ id, updates })}
        />
        <DestinationBlock
          routes={routes || []}
          targetNames={targetNames}
          onAdd={() => setIsAddRouteOpen(true)}
          onDelete={(routeId) => deleteRoute.mutate({ id: routeId, sourceId: id })}
        />
      </div>

      {/* Row 2: HUD DE FILTROS (Transparência) */}
      <div className="animate-in slide-in-from-bottom-4 duration-500 delay-100">
        <ActiveFilterHUD 
          filters={filters} 
          config={source.config} 
        />
      </div>

      {/* Row 3: RADAR ACTIVITY (Feed de Descoberta) */}
      {source.source_type === 'radar_offers' && (
        <div className="animate-in slide-in-from-bottom-4 duration-500 delay-150">
          <div className="mb-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 ml-1">Observabilidade do Radar Pro</h4>
          </div>
          <RadarActivityFeed sourceId={id} />
        </div>
      )}

      {/* Row 4: AUDIT TRAIL (Histórico de Envios) */}
      <div className="animate-in slide-in-from-bottom-4 duration-500 delay-200">
        <AutomationAuditTrail 
          campaigns={recentCampaigns || []} 
          isLoading={loadingRecent} 
        />
      </div>

      {/* Row 5: CONFIGURAÇÕES DE ENTREGA (Colapsável/Secundário) */}
      <div className="pt-10 border-t border-white/5 space-y-8 opacity-60 hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Configurações Avançadas de Esteira</h4>
          <Button 
            variant="ghost" 
            onClick={handleSavePipeline}
            disabled={isSaving}
            className="h-8 text-[9px] font-black uppercase tracking-widest text-kinetic-orange hover:bg-kinetic-orange/10"
          >
            {isSaving ? 'Salvando...' : 'Aplicar Alterações Manuais'}
          </Button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <InboundRuleManager
            filters={filters}
            onUpdate={setFilters}
          />
          <TemplateBlock
            template={template}
            onUpdate={setTemplate}
          />
        </div>
      </div>

      {/* Footer Audit Logs */}
      <div className="space-y-8 opacity-40">
        <LogFeed logs={logs || []} title="Atividade Técnica do Sistema" />
        <DeliveryBanner />
      </div>

      {/* Modals */}
      <Dialog open={isAddRouteOpen} onOpenChange={setIsAddRouteOpen}>
        <DialogContent className="bg-anthracite-surface border-white/5 shadow-skeuo-elevated">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-[0.2em] font-black text-xs text-white/60 mb-4">Adicionar Saída ao Pipeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black text-white/30 tracking-widest">Tipo de Destino</Label>
              <Select value={newRouteType} onValueChange={(v: any) => { setNewRouteType(v); setNewRouteTargetId(''); }}>
                <SelectTrigger className="bg-white/5 border-white/5 h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="group">Grupo Individual</SelectItem>
                  <SelectItem value="list">Lista Organizacional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black text-white/30 tracking-widest">Selecionar</Label>
              <Select value={newRouteTargetId} onValueChange={setNewRouteTargetId}>
                <SelectTrigger className="bg-white/5 border-white/5 h-12">
                  <SelectValue placeholder="Escolha um destino..." />
                </SelectTrigger>
                <SelectContent>
                  {newRouteType === 'group' ? (
                    groups?.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)
                  ) : (
                    lists?.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button
              className="w-full bg-kinetic-orange font-black uppercase tracking-widest h-14 rounded-2xl shadow-glow-orange-intense"
              onClick={handleAddRoute}
              disabled={!newRouteTargetId || upsertRoute.isPending}
            >
              {upsertRoute.isPending ? <Loader2 className="animate-spin" /> : 'Confirmar Novo Destino'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
