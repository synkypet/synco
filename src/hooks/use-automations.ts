// src/hooks/use-automations.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { automationService } from '@/services/supabase/automation-service';
import { AutomationSource, AutomationRoute } from '@/types/automation';

export function useAutomationSources(userId: string) {
  return useQuery({
    queryKey: ['automation-sources', userId],
    queryFn: () => automationService.listSources(userId),
    enabled: !!userId
  });
}

export function useCreateAutomationSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (source: Partial<AutomationSource> & { user_id: string; channel_id: string; external_group_id: string }) =>
      automationService.createSource({ ...source, source_type: 'group_monitor' }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['automation-sources', variables.user_id] });
    }
  });
}

export function useAutomationSource(id: string) {
  return useQuery({
    queryKey: ['automation-source', id],
    queryFn: () => automationService.getById(id),
    enabled: !!id
  });
}

export function useAutomationRoutes(sourceId: string) {
  return useQuery({
    queryKey: ['automation-routes', sourceId],
    queryFn: () => automationService.getRoutesBySourceId(sourceId),
    enabled: !!sourceId
  });
}

export function useAutomationLogs(sourceId: string) {
  return useQuery({
    queryKey: ['automation-logs', sourceId],
    queryFn: () => automationService.getLogs(sourceId),
    enabled: !!sourceId,
    refetchInterval: 5000 // Polling de 5s para observabilidade
  });
}

export function useUpdateAutomationSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<AutomationSource> }) =>
      automationService.updateSource(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['automation-source', variables.id] });
    }
  });
}

export function useUpsertAutomationRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (route: Partial<AutomationRoute> & { source_id: string; target_id: string }) =>
      automationService.upsertRoute(route),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['automation-routes', variables.source_id] });
    }
  });
}

export function useDeleteAutomationRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, sourceId }: { id: string; sourceId: string }) =>
      automationService.deleteRoute(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['automation-routes', variables.sourceId] });
    }
  });
}

export function useCreateAutomationPipeline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (setup: {
      userId: string;
      name: string;
      source_type: 'group_monitor' | 'radar_offers';
      channel_id?: string;
      external_group_id?: string;
      target_type: 'group' | 'list';
      target_id: string;
    }) => {
      const { userId, ...payload } = setup;
      return automationService.createPipeline(userId, payload);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['automation-sources', variables.userId] });
    }
  });
}
export function useDeleteAutomationSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => automationService.deleteSource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-sources'] });
    }
  });
}

export function useAutomationRecentCampaigns(sourceId: string) {
  return useQuery({
    queryKey: ['automation-recent-campaigns', sourceId],
    queryFn: () => automationService.getRecentCampaigns(sourceId, 10),
    enabled: !!sourceId,
    refetchInterval: 10000, 
  });
}
