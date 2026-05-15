// src/components/automation/QuickListCreateDialog.tsx
'use client';

import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { KineticButton } from '@/components/ui/KineticButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Group } from '@/types/group';
import { useCreateDestination } from '@/hooks/use-destinations';
import { List, Search, Users, Loader2 } from 'lucide-react';

interface QuickListCreateDialogProps {
  userId: string;
  groups: Group[] | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (listId: string) => void;
}

export function QuickListCreateDialog({
  userId,
  groups,
  open,
  onOpenChange,
  onCreated
}: QuickListCreateDialogProps) {
  const [name, setName] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const createDestination = useCreateDestination();

  const filteredGroups = groups?.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleToggleGroup = (groupId: string) => {
    setSelectedGroupIds(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId) 
        : [...prev, groupId]
    );
  };

  const handleCreate = async () => {
    if (!name.trim() || selectedGroupIds.length === 0) return;

    try {
      const newList = await createDestination.mutateAsync({
        destination: {
          user_id: userId,
          name: name.trim(),
          is_active: true
        },
        groupIds: selectedGroupIds
      });
      
      onCreated(newList.id);
      onOpenChange(false);
      // Reset form
      setName('');
      setSelectedGroupIds([]);
    } catch (err) {
      // Toast is handled by hook
    }
  };

  const isValid = name.trim().length >= 3 && selectedGroupIds.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-anthracite-surface border-white/5">
        <div className="p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <List size={18} className="text-kinetic-orange" />
              Criar Nova Lista de Destino
            </DialogTitle>
            <DialogDescription className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">
              Agrupe múltiplos canais para realizar disparos simultâneos via automação.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-6">
            {/* Nome da Lista */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black text-white/30 tracking-widest">
                Nome da Lista
              </Label>
              <Input 
                placeholder="Ex: Meus Grupos de Ofertas"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white/5 border-white/10"
              />
            </div>

            {/* Seleção de Grupos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase font-black text-white/30 tracking-widest">
                  Selecionar Grupos ({selectedGroupIds.length})
                </Label>
                <div className="relative w-32">
                  <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/20" />
                  <input 
                    type="text"
                    placeholder="Filtrar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-white/5 border-none rounded-lg py-1 pl-6 pr-2 text-[9px] text-white/60 focus:ring-1 ring-kinetic-orange/30 outline-none"
                  />
                </div>
              </div>

              <ScrollArea className="h-[200px] rounded-xl border border-white/5 bg-black/20 p-2">
                <div className="space-y-1">
                  {filteredGroups.length > 0 ? (
                    filteredGroups.map(group => (
                      <div 
                        key={group.id}
                        className={`flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer ${
                          selectedGroupIds.includes(group.id) ? 'bg-kinetic-orange/5' : 'hover:bg-white/5'
                        }`}
                        onClick={() => handleToggleGroup(group.id)}
                      >
                        <Checkbox 
                          id={`group-${group.id}`}
                          checked={selectedGroupIds.includes(group.id)}
                          onCheckedChange={() => handleToggleGroup(group.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white/80 truncate">{group.name}</p>
                          <p className="text-[8px] text-white/20 uppercase font-bold tracking-tight">
                            {group.members_count || 0} membros
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-10 text-center">
                      <p className="text-[10px] text-white/20 font-bold uppercase italic">Nenhum grupo encontrado</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>

        <DialogFooter className="bg-black/40 p-6">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white"
          >
            Cancelar
          </Button>
          <KineticButton 
            className={`h-12 px-8 rounded-xl ${!isValid ? 'grayscale opacity-50' : ''}`}
            onClick={handleCreate}
            disabled={!isValid || createDestination.isPending}
          >
            {createDestination.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Criar Lista'}
          </KineticButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
