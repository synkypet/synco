// src/components/automation/KeywordManager.tsx
'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, PlusCircle, Target, TrendingUp, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    if (keywords.length <= 1) return; // Manter pelo menos uma
    const newList = [...keywords];
    newList.splice(index, 1);
    onChange(newList);
  };

  const updateKeyword = (index: number, updates: Partial<Keyword>) => {
    const newList = [...keywords];
    newList[index] = { ...newList[index], ...updates };
    onChange(newList);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        {keywords.map((kw, idx) => (
          <div 
            key={idx} 
            className="group relative flex gap-3 items-center p-3 rounded-2xl bg-deep-void/40 border border-white/5 shadow-skeuo-pressed hover:border-white/10 transition-all duration-300 animate-in slide-in-from-left-2 fade-in"
          >
            {/* Index Indicator */}
            <div className="flex flex-col items-center justify-center w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-[10px] font-black text-white/20 group-hover:text-kinetic-orange/40 transition-colors">
              {idx + 1}
            </div>

            {/* Input Wrapper */}
            <div className="flex-1 flex items-center gap-3">
              <div className="relative flex-1">
                <Target size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/10 group-hover:text-kinetic-orange/40 transition-colors" />
                <Input 
                  value={kw.term}
                  placeholder={placeholder}
                  onChange={(e) => updateKeyword(idx, { term: e.target.value })}
                  className="h-10 bg-transparent border-none pl-9 text-[11px] font-black uppercase tracking-widest text-white placeholder:text-white/10 focus-visible:ring-0"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && kw.term.trim() && keywords.length < maxKeywords) {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                />
              </div>

              {showWeights && (
                <div className="flex items-center gap-3 px-3 border-l border-white/5">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={12} className="text-emerald-500/50" />
                    <span className="text-[8px] font-black text-white/20 uppercase tracking-tighter">Prioridade</span>
                  </div>
                  
                  <Input 
                    type="number"
                    min="1"
                    max="5"
                    value={kw.weight}
                    onChange={(e) => updateKeyword(idx, { weight: Math.min(5, Math.max(1, parseInt(e.target.value) || 1)) })}
                    className="h-8 w-10 bg-deep-void border border-white/5 text-[11px] font-black text-center rounded-lg p-0 text-emerald-400 shadow-skeuo-pressed"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => removeKeyword(idx)}
              disabled={keywords.length <= 1}
              className="h-8 w-8 text-white/10 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100 disabled:hidden"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </div>
      
      <div className="flex items-center justify-between px-2 pt-2 border-t border-white/5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {[...Array(maxKeywords)].map((_, i) => (
              <div 
                key={i} 
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all duration-500",
                  i < keywords.length ? "bg-kinetic-orange shadow-glow-orange" : "bg-white/5"
                )} 
              />
            ))}
          </div>
          <span className="text-[9px] font-black text-white/20 uppercase tracking-widest ml-2">
            {keywords.length} de {maxKeywords} Nichos
          </span>
        </div>

        {keywords.length < maxKeywords && (
          <Button 
            variant="ghost" 
            className="h-10 px-4 text-[9px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-white hover:bg-white/5 rounded-2xl border border-white/5 shadow-skeuo-flat group transition-all"
            onClick={addKeyword}
          >
            <PlusCircle size={14} className="mr-2 text-kinetic-orange transition-transform group-hover:rotate-90" />
            Adicionar Nicho
          </Button>
        )}
      </div>
    </div>
  );
}
