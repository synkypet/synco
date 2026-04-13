'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Channel } from '@/types/group';
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

const formSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  type: z.enum(['whatsapp', 'telegram']),
  description: z.string().optional(),
  phoneNumber: z.string().optional().refine((val) => {
    // Se for whatsapp, o telefone é obrigatório
    return true; // A validação real será feita no superRefine ou condicionalmente
  }),
}).superRefine((data, ctx) => {
  if (data.type === 'whatsapp' && (!data.phoneNumber || data.phoneNumber.trim().length < 8)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Telefone é obrigatório para WhatsApp',
      path: ['phoneNumber'],
    });
  }
});

interface ChannelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: z.infer<typeof formSchema>) => void;
  initialData?: Channel | null;
  isSubmitting?: boolean;
}

export function ChannelDialog({ 
  isOpen, 
  onClose, 
  onSubmit, 
  initialData,
  isSubmitting 
}: ChannelDialogProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
      defaultValues: {
        name: initialData?.name || '',
        type: (initialData?.type as 'whatsapp' | 'telegram') || 'whatsapp',
        description: initialData?.description || '',
        phoneNumber: initialData?.config?.phoneNumber || '',
      },
    });
  
    React.useEffect(() => {
      if (isOpen) {
        if (initialData) {
          form.reset({
            name: initialData.name,
            type: initialData.type as 'whatsapp' | 'telegram',
            description: initialData.description || '',
            phoneNumber: initialData.config?.phoneNumber || '',
          });
        } else {
          form.reset({
            name: '',
            type: 'whatsapp',
            description: '',
            phoneNumber: '',
          });
        }
      }
    }, [initialData, form, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Editar Canal' : 'Criar Novo Canal'}</DialogTitle>
          <DialogDescription>
            Canais são as plataformas onde você publica suas ofertas.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Canal</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Meu Grupo de Promoções" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Protocolo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp (Wasender)</SelectItem>
                      <SelectItem value="telegram">Telegram (Bot / User)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch('type') === 'whatsapp' && (
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem className="animate-in fade-in slide-in-from-top-2">
                    <FormLabel>Número do WhatsApp</FormLabel>
                    <FormControl>
                      <Input placeholder="+5511999999999" {...field} />
                    </FormControl>
                    <FormDescription>
                      Número completo com DDI (Ex: +55).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição Operacional (Opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Canal principal de promoções da tarde" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="min-w-[100px]">
                {isSubmitting ? 'Salvando...' : 'Salvar Canal'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
