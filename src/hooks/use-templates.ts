import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { templateService } from '@/services/supabase/template-service';
import { Template } from '@/types/template';
import { toast } from 'sonner';

export function useTemplates(userId: string | undefined) {
  return useQuery({
    queryKey: ['templates', userId],
    queryFn: () => userId ? templateService.list(userId) : Promise.resolve([]),
    enabled: !!userId,
  });
}

export function useUpsertTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (template: Partial<Template> & { user_id: string }) => 
      templateService.upsert(template),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['templates', variables.user_id] });
      toast.success(variables.id ? 'Template atualizado!' : 'Template criado!');
    },
    onError: (error) => {
      console.error('Error upserting template:', error);
      toast.error('Erro ao salvar template.');
    }
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, user_id }: { id: string; user_id: string }) => 
      templateService.delete(id, user_id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['templates', variables.user_id] });
      toast.success('Template excluído com sucesso!');
    },
    onError: (error) => {
      console.error('Error deleting template:', error);
      toast.error('Erro ao excluir template.');
    }
  });
}
