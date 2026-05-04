'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DestinationList } from '@/types/destination-list';
import { useGroups } from '@/hooks/use-groups';
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
import { MessageCircle, Send, AlertCircle, Search, Hash, Info, Check, List } from 'lucide-react';
import Link from 'next/link';

const formSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  description: z.string().optional(),
  icon: z.string().optional(),
  groupIds: z.array(z.string()).min(1, 'Selecione pelo menos um grupo'),
});

const SKEUO_ICONS = ['📁', '🔥', '💻', '🏠', '👑', '📱', '🎯', '📢', '📦', '✨', '⚡', '🤖', '🛒'];

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
  
  const [filter, setFilter] = useState('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      icon: '📁',
      groupIds: [],
    },
  });

  // Efeito de Reset Crítico para Pré-seleção
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        console.log('[DEBUG] Loading initial data for editing:', initialData);
        form.reset({
          name: initialData.name,
          description: initialData.description || '',
          icon: initialData.icon || '📁',
          groupIds: initialData.group_ids || [],
        });
      } else {
        form.reset({
          name: '',
          description: '',
          icon: '📁',
          groupIds: [],
        });
      }
    }
  }, [initialData, form, isOpen]);

  const selectedCount = form.watch('groupIds').length;
  const currentSelections = form.watch('groupIds');

  const filteredGroups = useMemo(() => {
    return groups?.filter(g => 
      g.name.toLowerCase().includes(filter.toLowerCase())
    );
  }, [groups, filter]);

  const totalMembers = useMemo(() => {
    if (!groups) return 0;
    return groups
      .filter(g => currentSelections.includes(g.id))
      .reduce((sum, g) => sum + (g.members_count || 0), 0);
  }, [groups, currentSelections]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-anthracite-surface border-white/5 shadow-skeuo-elevated p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-white/[0.05] to-transparent p-6">
          <DialogHeader className="mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-kinetic-orange/10 rounded-2xl shadow-glow-orange-intense/20">
                <List className="text-kinetic-orange" size={24} />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-white/90 uppercase tracking-tight">
                  {initialData ? 'Configurar Lista' : 'Nova Esteira de Destino'}
                </DialogTitle>
                <DialogDescription className="text-white/40 text-[11px] font-medium uppercase tracking-widest">
                  Agrupe múltiplos grupos para disparos otimizados
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {!groups || groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
              <div className="p-5 bg-white/5 text-kinetic-orange rounded-full shadow-skeuo-flat">
                <AlertCircle size={32} />
              </div>
              <div className="space-y-2">
                <p className="font-bold text-white/80">Nenhum grupo operacional detectado</p>
                <p className="text-xs text-white/30 max-w-[280px]">Você precisa sincronizar seus grupos antes de criar listas dinâmicas.</p>
              </div>
              <Button asChild className="bg-white/5 hover:bg-white/10 border border-white/10 h-12 px-8 uppercase font-bold text-[11px] tracking-widest">
                <Link href="/grupos">Sincronizar Grupos agora</Link>
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Coluna Esquerda: Meta-dados */}
                  <div className="space-y-5">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel htmlFor="destination-name" className="text-[10px] uppercase font-black text-white/30 tracking-[0.2em]">Identificação</FormLabel>
                          <FormControl>
                            <Input 
                              id="destination-name"
                              autoComplete="organization"
                              placeholder="Filtro VIP..." 
                              className="bg-white/5 border-white/5 h-12 text-sm font-medium focus:ring-kinetic-orange/20 shadow-skeuo-pressed"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage className="text-[10px] text-red-400 font-bold" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="icon"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-[10px] uppercase font-black text-white/30 tracking-[0.2em]">Ícone Visual</FormLabel>
                          <div className="grid grid-cols-7 gap-1.5 p-2 bg-white/[0.03] rounded-2xl shadow-skeuo-pressed border border-white/5">
                            {SKEUO_ICONS.map((icon) => (
                              <button
                                key={icon}
                                type="button"
                                onClick={() => field.onChange(icon)}
                                className={`h-8 w-8 flex items-center justify-center rounded-lg transition-all ${
                                  field.value === icon 
                                    ? 'bg-kinetic-orange/20 shadow-glow-orange-intense/20 scale-110' 
                                    : 'hover:bg-white/5'
                                }`}
                              >
                                <span className="text-sm">{icon}</span>
                              </button>
                            ))}
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel htmlFor="destination-description" className="text-[10px] uppercase font-black text-white/30 tracking-[0.2em]">Nota Operacional</FormLabel>
                          <FormControl>
                            <Input 
                              id="destination-description"
                              autoComplete="off"
                              placeholder="Ex: Grupos de Eletrônicos..." 
                              className="bg-white/5 border-white/5 h-12 text-sm font-medium focus:ring-kinetic-orange/20 shadow-skeuo-pressed"
                              {...field} 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="bg-kinetic-orange/5 rounded-3xl p-4 border border-kinetic-orange/10 shadow-skeuo-flat">
                       <div className="flex items-center gap-2 mb-3">
                          <Hash size={14} className="text-kinetic-orange" />
                          <span className="text-[10px] font-black uppercase text-kinetic-orange tracking-widest">Resumo da Seleção</span>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                             <p className="text-[9px] text-white/30 uppercase font-bold mb-1">Membros Totais</p>
                             <p className="text-lg font-black text-white/80 italic">{totalMembers.toLocaleString()}</p>
                          </div>
                          <div>
                             <p className="text-[9px] text-white/30 uppercase font-bold mb-1">Grupos Ativos</p>
                             <p className="text-lg font-black text-white/80 italic">{selectedCount}</p>
                          </div>
                       </div>
                    </div>
                  </div>

                  {/* Coluna Direita: Seleção de Grupos */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <FormLabel className="text-[10px] uppercase font-black text-white/30 tracking-[0.2em]">Vincular Canais</FormLabel>
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-white/20" size={12} />
                        <input 
                          id="group-filter"
                          name="group-filter"
                          autoComplete="off"
                          placeholder="Buscar..." 
                          className="h-7 w-32 bg-white/5 border border-white/10 rounded-lg pl-7 text-[10px] font-bold text-white/80 placeholder:text-white/10 focus:outline-none focus:border-kinetic-orange/40" 
                          value={filter}
                          onChange={(e) => setFilter(e.target.value)}
                        />
                      </div>
                    </div>

                    <ScrollArea className="h-[320px] rounded-3xl border border-white/5 bg-white/[0.02] p-4 shadow-skeuo-pressed">
                      <div className="space-y-2">
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
                                  <div 
                                    onClick={() => {
                                      const newVal = isChecked
                                        ? field.value?.filter((v) => v !== group.id)
                                        : [...(field.value || []), group.id];
                                      field.onChange(newVal);
                                    }}
                                    className={`group flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                                      isChecked 
                                        ? 'bg-kinetic-orange/5 border-kinetic-orange/30 shadow-glow-orange' 
                                        : 'bg-white/[0.03] border-white/5 hover:border-white/10'
                                    }`}
                                  >
                                    <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                                      isChecked 
                                        ? 'bg-kinetic-orange border-kinetic-orange shadow-glow-orange-intense' 
                                        : 'bg-white/5 border-white/10'
                                    }`}>
                                      {isChecked && <Check size={12} className="text-white" strokeWidth={4} />}
                                    </div>
                                    
                                    <div className="flex-1 overflow-hidden">
                                      <p className={`text-xs font-bold truncate ${isChecked ? 'text-white/90' : 'text-white/50'}`}>
                                        {group.name}
                                      </p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[9px] text-white/20 font-medium">{group.members_count || 0} membros</span>
                                        {channel && (
                                          <span className="text-[8px] uppercase font-black text-kinetic-orange/60">
                                            {channel.name}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              }}
                            />
                          )
                        })}
                        {filteredGroups?.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-10 opacity-20">
                             <Info size={24} />
                             <p className="text-[10px] font-bold uppercase mt-2">Sem resultados</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                    <FormMessage className="text-[10px] text-red-400 font-bold px-1" />
                  </div>
                </div>

                <DialogFooter className="pt-2 flex gap-3">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={onClose} 
                    disabled={isSubmitting}
                    className="flex-1 h-12 bg-white/5 hover:bg-white/10 text-white/40 font-bold uppercase text-[10px] tracking-widest rounded-2xl"
                  >
                    Encerrar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="flex-[2] h-12 bg-kinetic-orange hover:bg-kinetic-orange/90 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl shadow-glow-orange-intense"
                  >
                    {isSubmitting ? 'Sincronizando...' : initialData ? 'Salvar Configuração' : 'Ativar Esteira'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
