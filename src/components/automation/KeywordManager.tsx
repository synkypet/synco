// src/components/automation/KeywordManager.tsx
'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ShieldAlert, PlusCircle, Inbox } from 'lucide-react';

export interface Keyword {
  term: string;
  weight: number;
}

interface KeywordManagerProps {
  keywords: Keyword[];
  onChange: (keywords: Keyword[]) => void;
  maxKeywords?: number;
  showWeights?: boolean;
  placeholder?: string;
}

export function KeywordManager({ 
  keywords, 
  onChange, 
  maxKeywords = 5,
  showWeights = true,
  placeholder = "Ex: fone bluetooth"
}: KeywordManagerProps) {
  
  const addKeyword = () => {
    if (keywords.length < maxKeywords) {
      onChange([...keywords, { term: '', weight: 1 }]);
    }
  };

  const removeKeyword = (index: number) => {
    const newList = [...keywords];
    newList.splice(index, 1);
    onChange(newList);
  };

  const updateKeyword = (index: number, updates: Partial<Keyword>) => {
    const newList = [...keywords];
    newList[index] = { ...newList[index], ...updates };
    onChange(newList);
  };

  // Se não houver keywords iniciais, adicionamos uma vazia
  React.useEffect(() => {
    if (keywords.length === 0) {
      onChange([{ term: '', weight: 1 }]);
    }
  }, []);

  return (
    <div className="space-y-3">
      {keywords.map((kw, idx) => (
        <div key={idx} className="flex gap-2 items-center">
          <div className="flex-1 bg-white/5 rounded-xl border border-white/5 px-1 flex items-center">
            <Input 
              value={kw.term}
              placeholder={placeholder}
              onChange={(e) => updateKeyword(idx, { term: e.target.value })}
              className="h-9 bg-transparent border-none text-[11px] font-bold focus-visible:ring-0 text-white placeholder:text-white/20"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && kw.term.trim() && keywords.length < maxKeywords) {
                  e.preventDefault();
                  addKeyword();
                }
              }}
            />
            {showWeights && (
              <div className="flex items-center gap-1 pr-2 border-l border-white/5 ml-1">
                <span className="text-[8px] font-black text-white/20 uppercase ml-2">Peso</span>
                <Input 
                  type="number"
                  min="1"
                  max="10"
                  value={kw.weight}
                  onChange={(e) => updateKeyword(idx, { weight: parseInt(e.target.value) || 1 })}
                  className="h-7 w-10 bg-white/5 border-none text-[10px] font-black text-center rounded-lg p-0 text-white"
                />
              </div>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => removeKeyword(idx)}
            className="h-9 w-9 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-xl"
          >
            <ShieldAlert size={14} />
          </Button>
        </div>
      ))}
      
      <div className="flex items-center justify-between pt-2">
        <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">
          {keywords.length} de {maxKeywords} palavras-chave
        </p>
        {keywords.length < maxKeywords && (
          <Button 
            variant="ghost" 
            className="h-8 text-[9px] font-bold text-white/40 hover:text-white hover:bg-white/5 rounded-xl border border-white/5"
            onClick={addKeyword}
          >
            <PlusCircle size={12} className="mr-1" />
            Adicionar Keyword
          </Button>
        )}
      </div>
    </div>
  );
}
