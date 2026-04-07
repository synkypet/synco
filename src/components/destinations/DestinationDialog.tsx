'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DestinationList } from '@/types/destination-list';
import { useGroups } from '@/hooks/use-groups';
import { useChannels } from '@/hooks/use-channels';
import { useAuth } from '@/contexts/AuthContext';
import { useDestinationGroups } from '@/hooks/use-destinations';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Send, AlertCircle, Search } from 'lucide-react';
import Link from 'next/link';

const formSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  description: z.string().optional(),
  groupIds: z.array(z.string()).min(1, 'Selecione pelo menos um grupo'),
});

interface DestinationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: z.infer<typeof formSchema>) => void;
  initialData?: DestinationList | null;
  isSubmitting?: boolean;
}

export function DestinationDialog({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialData,
  isSubmitting 
}: DestinationDialogProps) {
  const { user } = useAuth();
  const { data: groups } = useGroups(user?.id);
  const { data: channels } = useChannels(user?.id);
  const { data: currentGroupsRelations } = useDestinationGroups(initialData?.id);
  
  const [filter, setFilter] = React.useState('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      groupIds: [],
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      if (initialData) {
        const gIds = currentGroupsRelations?.map(rel => rel.group_id) || [];
        form.reset({
          name: initialData.name,
          description: initialData.description || '',
          groupIds: gIds,
        });
      } else {
        form.reset({
          name: '',
          description: '',
          groupIds: [],
        });
      }
    }
  }, [initialData, currentGroupsRelations, form, isOpen]);

  const filteredGroups = groups?.filter(g => 
    g.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Editar Lista' : 'Criar Nova Lista'}</DialogTitle>
          <DialogDescription>
            Agrupe vários grupos de destino em uma única lista para envios em massa.
          </DialogDescription>
        </DialogHeader>

        {!groups || groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-full">
              <AlertCircle size={24} />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Nenhum grupo cadastrado</p>
              <p className="text-sm text-muted-foreground">Você precisa cadastrar grupos antes de criar listas.</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/grupos">Ir para Grupos</Link>
            </Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Lista</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Todos os Canais VIP" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <FormLabel>Selecionar Grupos ({form.watch('groupIds').length})</FormLabel>
                  <div className="relative w-40">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" size={12} />
                    <Input 
                      placeholder="Filtrar..." 
                      className="h-7 pl-7 text-xs" 
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    />
                  </div>
                </div>
                <ScrollArea className="h-[200px] rounded-md border p-4 bg-muted/20">
                  <div className="space-y-3">
                    {filteredGroups?.map((group) => {
                      const channel = channels?.find(c => c.id === group.channel_id);
                      return (
                        <FormField
                          key={group.id}
                          control={form.control}
                          name="groupIds"
                          render={({ field }) => {
                            const isChecked = field.value?.includes(group.id);
                            return (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-1 hover:bg-muted/50 rounded-sm transition-colors">
                                <FormControl>
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, group.id])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== group.id
                                            )
                                          )
                                    }}
                                  />
                                </FormControl>
                                <div className="flex items-center gap-2 flex-1 overflow-hidden">
                                  <FormLabel className="font-medium flex-1 cursor-pointer truncate">
                                    {group.name}
                                  </FormLabel>
                                  {channel && (
                                    <Badge variant="outline" className="text-[10px] uppercase font-bold h-5 shrink-0">
                                      {channel.type === 'whatsapp' ? <MessageCircle size={10} className="mr-1 text-green-600" /> : <Send size={10} className="mr-1 text-blue-600" />}
                                      {channel.name}
                                    </Badge>
                                  )}
                                </div>
                              </FormItem>
                            )
                          }}
                        />
                      )
                    })}
                    {filteredGroups?.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-4">Nenhum grupo encontrado.</p>
                    )}
                  </div>
                </ScrollArea>
                <FormMessage />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição (Opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Breve nota sobre esta lista" {...field} />
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
                  {isSubmitting ? 'Salvando...' : 'Salvar Lista'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
