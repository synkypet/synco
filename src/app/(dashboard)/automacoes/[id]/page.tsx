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
import { useChannels } from '@/hooks/use-channels';

import { OriginBlock } from '@/components/automation/OriginBlock';
import { TemplateBlock } from '@/components/automation/TemplateBlock';
import { DestinationBlock } from '@/components/automation/DestinationBlock';
import { DeliveryBanner } from '@/components/automation/DeliveryBanner';
import { LogFeed } from '@/components/automation/LogFeed';
import { AutomationStatusHeader } from '@/components/automation/AutomationStatusHeader';
import { AutomationTargetSelector } from '@/components/automation/AutomationTargetSelector';
import { QuickListCreateDialog } from '@/components/automation/QuickListCreateDialog';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  const { data: allGroups } = useGroups(user?.id as string);
  const { data: allLists } = useDestinations(user?.id as string);
  const { data: channels } = useChannels(user?.id as string);

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
  const [isQuickListOpen, setIsQuickListOpen] = useState(false);
  const [newRouteTargetType, setNewRouteTargetType] = useState<'group' | 'list'>('list');
  const [newRouteTargetId, setNewRouteTargetId] = useState('');

  // Sincronizar estado local com a primeira rota (Regras globais)
  useEffect(() => {
    if (routes && routes.length > 0) {
      setFilters(routes[0].filters || {});
      setTemplate(routes[0].template_config || {});
    }
  }, [routes]);

  if (loadingSource || loadingRoutes) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="animate-spin text-kinetic-orange" size={40} />
        <p className="text-muted-foreground animate-pulse font-bold uppercase tracking-widest text-[10px]">Sincronizando Automação...</p>
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
      const promises = routes.map(route => upsertRoute.mutateAsync({
        ...route,
        source_id: id, // Forçar source_id da página
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
      loading: 'Excluindo automação...',
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
      target_type: newRouteTargetType,
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
        return "Novo destino vinculado.";
      },
      error: "Erro ao vincular destino."
    });
  };

  const targetNames: Record<string, string> = {};
  routes?.forEach(r => {
    if (r.target_type === 'group') {
      targetNames[r.id] = allGroups?.find(g => g.id === r.target_id)?.name || 'Grupo de WhatsApp';
    } else {
      targetNames[r.id] = allLists?.find(l => l.id === r.target_id)?.name || 'Lista de Destino';
    }
  });

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-32 animate-in fade-in duration-1000">
      <AutomationStatusHeader 
        source={source} 
        onBack={() => router.push('/automacoes')} 
      />

      {/* BLOCO 1: CENTRO DE COMANDO (NICHOS, RITMO E CURADORIA) */}
      <OriginBlock
        source={source}
        allGroups={allGroups || []}
        targetNames={targetNames}
        onAddDestination={() => setIsAddRouteOpen(true)}
        onDeleteDestination={(routeId) => deleteRoute.mutate({ id: routeId, sourceId: id })}
        onUpdate={(updates) => {
          // Se houver updates de automation_routes, usamos a mutation de rota
          if (updates.automation_routes && updates.automation_routes[0]) {
            const r = updates.automation_routes[0];
            upsertRoute.mutate({ ...r, source_id: id });
          } else {
            updateSource.mutate({ id, updates });
          }
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* COLUNA DA ESQUERDA/CENTRAL: HISTÓRICO DE AÇÕES */}
        <div className={`${source.source_type === 'group_monitor' ? 'lg:col-span-3' : 'lg:col-span-2'} space-y-8`}>
           <div className="animate-in slide-in-from-bottom-4 duration-500">
              <LogFeed 
                logs={logs || []} 
                title={source.source_type === 'group_monitor' ? "O que o sistema está fazendo agora" : "Histórico de Ações do Sistema"} 
                targetNames={targetNames} 
                sourceType={source.source_type}
              />
           </div>
        </div>

        {/* COLUNA DA DIREITA: DESTINOS (OCULTA NO MONITOR) */}
        {source.source_type !== 'group_monitor' && (
          <div className="space-y-8">
            <DestinationBlock
              routes={routes || []}
              targetNames={targetNames}
              onAdd={() => setIsAddRouteOpen(true)}
              onDelete={(routeId) => deleteRoute.mutate({ id: routeId, sourceId: id })}
            />
          </div>
        )}
      </div>

      <div className="space-y-8 opacity-40">
        <DeliveryBanner />
      </div>

      <Dialog open={isAddRouteOpen} onOpenChange={setIsAddRouteOpen}>
        <DialogContent className="bg-anthracite-surface border-white/5 shadow-skeuo-elevated">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-[0.2em] font-black text-xs text-white/60 mb-4">Adicionar Saída ao Pipeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <AutomationTargetSelector 
              groups={allGroups}
              lists={allLists}
              type={newRouteTargetType}
              value={newRouteTargetId}
              onTypeChange={setNewRouteTargetType}
              onValueChange={setNewRouteTargetId}
              onNewList={() => setIsQuickListOpen(true)}
              hideGroupOption={true}
            />
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

      <QuickListCreateDialog 
        userId={user?.id as string}
        groups={allGroups}
        open={isQuickListOpen}
        onOpenChange={setIsQuickListOpen}
        onCreated={(listId) => {
          setNewRouteTargetType('list');
          setNewRouteTargetId(listId);
        }}
      />
    </div>
  );
}
