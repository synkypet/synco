// src/components/automation/AutomationTargetSelector.tsx
'use client';

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Group } from '@/types/group';
import { DestinationList } from '@/types/destination-list';
import { Users, List, Target } from 'lucide-react';

interface AutomationTargetSelectorProps {
  groups: Group[] | undefined;
  lists: DestinationList[] | undefined;
  value: string;
  type: 'group' | 'list';
  onValueChange: (value: string) => void;
  onTypeChange: (type: 'group' | 'list') => void;
  onNewList?: () => void;
  hideGroupOption?: boolean;
}

export function AutomationTargetSelector({ 
  groups, 
  lists, 
  value, 
  type, 
  onValueChange, 
  onTypeChange,
  onNewList,
  hideGroupOption = false
}: AutomationTargetSelectorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase font-bold opacity-60 tracking-widest">Aonde enviar? (Destino)</Label>
          {onNewList && (
            <button 
              onClick={(e) => { e.preventDefault(); onNewList(); }}
              className="text-[9px] font-black uppercase tracking-widest text-kinetic-orange hover:underline"
            >
              + Nova Lista
            </button>
          )}
        </div>
        {!hideGroupOption && (
          <div className="flex gap-2">
            <button
              onClick={() => { onTypeChange('group'); onValueChange(''); }}
              className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-wider ${
                type === 'group' 
                  ? 'bg-kinetic-orange/10 border-kinetic-orange/40 text-kinetic-orange shadow-glow-orange' 
                  : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
              }`}
            >
              <Users size={14} /> Grupo Único
            </button>
            <button
              onClick={() => { onTypeChange('list'); onValueChange(''); }}
              className={`flex-1 flex items-center justify-center gap-2 h-10 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-wider ${
                type === 'list' 
                  ? 'bg-kinetic-orange/10 border-kinetic-orange/40 text-kinetic-orange shadow-glow-orange' 
                  : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
              }`}
            >
              <List size={14} /> Lista Salva
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger className="bg-white/5 border-white/10 h-12">
            <SelectValue placeholder={type === 'group' ? "Selecione o grupo de destino" : "Selecione a lista de destino"} />
          </SelectTrigger>
          <SelectContent>
            {type === 'group' ? (
              groups?.map(g => (
                <SelectItem key={g.id} value={g.id} className="gap-2">
                   <div className="flex items-center gap-2">
                      <Target size={12} className="opacity-40" />
                      <span>{g.name}</span>
                   </div>
                </SelectItem>
              ))
            ) : (
              lists && lists.length > 0 ? (
                lists.map(l => (
                  <SelectItem key={l.id} value={l.id} className="gap-2">
                     <div className="flex items-center gap-2">
                        <List size={12} className="opacity-40" />
                        <span>{l.name} ({l.group_ids?.length || 0} grupos)</span>
                     </div>
                  </SelectItem>
                ))
              ) : (
                <div className="p-4 text-center">
                  <p className="text-[10px] font-bold text-white/20 uppercase">Nenhuma lista encontrada</p>
                  {onNewList && (
                    <Button 
                      variant="link" 
                      size="sm" 
                      onClick={onNewList}
                      className="text-kinetic-orange text-[9px] font-black uppercase mt-1"
                    >
                      Criar agora
                    </Button>
                  )}
                </div>
              )
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
