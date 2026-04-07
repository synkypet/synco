'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Group } from '@/types/group';
import { useChannels } from '@/hooks/use-channels';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

const formSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  channel_id: z.string().uuid('Selecione um canal válido'),
  description: z.string().optional(),
})

interface GroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: z.infer<typeof formSchema>) => void;
  initialData?: Group | null;
  isSubmitting?: boolean;
}

export function GroupDialog({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialData,
  isSubmitting 
}: GroupDialogProps) {
  const { user } = useAuth();
  const { data: channels, isLoading: isLoadingChannels } = useChannels(user?.id);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || '',
      channel_id: initialData?.channel_id || '',
      description: initialData?.description || '',
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      if (initialData) {
        form.reset({
          name: initialData.name,
          channel_id: initialData.channel_id,
          description: initialData.description || '',
        });
      } else {
        form.reset({
          name: '',
          channel_id: '',
          description: '',
        });
      }
    }
  }, [initialData, form, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Editar Grupo' : 'Criar Novo Grupo'}</DialogTitle>
          <DialogDescription>
            Grupos são os destinos finais das suas mensagens dentro de um canal.
          </DialogDescription>
        </DialogHeader>
        
        {!isLoadingChannels && (!channels || channels.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-full">
              <AlertCircle size={24} />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Nenhum canal cadastrado</p>
              <p className="text-sm text-muted-foreground">Você precisa criar um canal antes de adicionar grupos.</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/canais">Ir para Canais</Link>
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Grupo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Promoções Imperdíveis" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="channel_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Canal</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o canal" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {channels?.map((channel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            {channel.name} ({channel.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Vincule este grupo a um canal existente.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Notas sobre este grupo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : 'Salvar Grupo'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
