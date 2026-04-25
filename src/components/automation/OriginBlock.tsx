// src/components/automation/OriginBlock.tsx
'use client';

import React, { useState } from 'react';
import { TactileCard } from '@/components/ui/TactileCard';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Radio, Activity, ShieldCheck, Power, Inbox, ShieldAlert, Zap, Target, Flame, Scale, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AutomationSource } from '@/types/automation';
import { Input } from '@/components/ui/input';

import { normalizeKeywords, calculateKeywordBudgets, getBudgetByPreset } from '@/lib/automation/keyword-utils';

interface OriginBlockProps {
  source: AutomationSource;
  sourceName?: string;
  onUpdate: (updates: Partial<AutomationSource>) => void;
}

export function OriginBlock({ source, sourceName, onUpdate }: OriginBlockProps) {
  const isRadar = source.source_type === 'radar_offers';
  const config = (source.config as any) || {};
  
  // Usar a utility para garantir consistência
  const initialKeywords = normalizeKeywords(config);
  
  const [isEditingKeyword, setIsEditingKeyword] = useState(false);
  const [localKeywords, setLocalKeywords] = useState(initialKeywords);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const currentPreset = config.preset_type || 'balanced';
  
  // Preview utiliza a mesma lógica do backend (Centralizada)
  const totalBudget = getBudgetByPreset(currentPreset, config.batchLimit);
  const activeKeywords = isEditingKeyword ? localKeywords : initialKeywords;
  const budgetPreview = calculateKeywordBudgets(totalBudget, activeKeywords);

  const handleUpdatePreset = (preset: string) => {
    onUpdate({ config: { ...config, preset_type: preset } });
  };

  const handleSaveKeywords = () => {
    onUpdate({
      config: {
        ...config,
        keywords: localKeywords,
        searchTerm: localKeywords[0]?.term || '' // Sync primary keyword for backward compatibility
      }
    });
    setIsEditingKeyword(false);
  };

  const addKeyword = () => {
    if (localKeywords.length < 5) {
      setLocalKeywords([...localKeywords, { term: '', weight: 1 }]);
    }
  };

  const removeKeyword = (index: number) => {
    const newList = [...localKeywords];
    newList.splice(index, 1);
    setLocalKeywords(newList);
  };

  const updateKeyword = (index: number, updates: any) => {
    const newList = [...localKeywords];
    newList[index] = { ...newList[index], ...updates };
    setLocalKeywords(newList);
  };

  return (
    <TactileCard className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2">
          {isRadar ? <Zap size={14} className="text-kinetic-orange" /> : <Radio size={14} className="text-kinetic-orange animate-pulse" />}
          1. Motor de Estratégia ({isRadar ? 'Radar Pro' : 'Monitoramento'})
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onUpdate({ is_active: !source.is_active })}
          className={cn(
            "h-8 gap-2 uppercase font-bold text-[9px] tracking-widest px-3 rounded-xl border border-white/5 transition-all",
            source.is_active 
              ? "text-emerald-500 hover:text-emerald-400 bg-emerald-500/5 shadow-glow-emerald shadow-emerald-500/10" 
              : "text-zinc-500 hover:text-zinc-400 bg-white/5"
          )}
        >
          <Power size={12} />
          {source.is_active ? 'Rodando' : 'Pausado'}
        </Button>
      </div>

      <div className="space-y-6">
        {/* Multi-Keyword Section */}
        <div className="bg-deep-void rounded-2xl p-5 shadow-skeuo-pressed border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Configuração de Busca (Keywords)</span>
            {isRadar && (
              <Button 
                variant="ghost" 
                className="h-6 gap-2 text-[9px] font-black uppercase text-kinetic-orange/60 hover:text-kinetic-orange px-2 rounded-lg bg-kinetic-orange/5"
                onClick={() => {
                  if (!isEditingKeyword) setLocalKeywords(normalizeKeywords(config));
                  setIsEditingKeyword(!isEditingKeyword);
                }}
              >
                <Zap size={10} />
                {isEditingKeyword ? 'Cancelar' : 'Gerenciar'}
              </Button>
            )}
          </div>
          
          {isEditingKeyword ? (
            <div className="space-y-3">
              {localKeywords.map((kw, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <div className="flex-1 bg-white/5 rounded-xl border border-white/5 px-1 flex items-center">
                    <Input 
                      value={kw.term}
                      placeholder="Ex: fone bluetooth"
                      onChange={(e) => updateKeyword(idx, { term: e.target.value })}
                      className="h-9 bg-transparent border-none text-[11px] font-bold focus-visible:ring-0"
                    />
                    <div className="flex items-center gap-1 pr-2 border-l border-white/5 ml-1">
                      <span className="text-[8px] font-black text-white/20 uppercase ml-2">Peso</span>
                      <Input 
                        type="number"
                        min="1"
                        max="10"
                        value={kw.weight}
                        onChange={(e) => updateKeyword(idx, { weight: parseInt(e.target.value) || 1 })}
                        className="h-7 w-10 bg-white/5 border-none text-[10px] font-black text-center rounded-lg p-0"
                      />
                    </div>
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
                {localKeywords.length < 5 && (
                  <Button 
                    variant="ghost" 
                    className="h-8 text-[9px] font-bold text-white/40 hover:text-white hover:bg-white/5 rounded-xl border border-white/5"
                    onClick={addKeyword}
                  >
                    + Adicionar Keyword
                  </Button>
                )}
                <Button 
                  className="h-9 bg-kinetic-orange hover:bg-kinetic-orange/80 text-white font-black text-[10px] uppercase tracking-widest px-6 rounded-xl shadow-glow-orange"
                  onClick={handleSaveKeywords}
                >
                  Salvar Alterações
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {activeKeywords.length > 0 ? activeKeywords.map((kw, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.03]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-kinetic-orange/10 border border-kinetic-orange/20 flex items-center justify-center">
                      <Inbox size={14} className="text-kinetic-orange" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black tracking-tight text-white/90 uppercase">{kw.term || 'Vazio'}</p>
                      <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">Peso: {kw.weight}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-kinetic-orange italic tracking-tight">Até ~{budgetPreview[idx] || 0} produtos</p>
                    <p className="text-[8px] font-bold text-white/10 uppercase">Budget Alocado</p>
                  </div>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center py-4 border border-dashed border-white/5 rounded-xl opacity-40">
                  <Inbox size={20} className="mb-2" />
                  <p className="text-[9px] font-bold uppercase tracking-widest text-center">Nenhuma keyword configurada</p>
                </div>
              )}

              {activeKeywords.length > 1 && (
                <div className="pt-2 px-1 flex items-start gap-2">
                  <ShieldAlert size={10} className="text-white/20 mt-0.5" />
                  <p className="text-[8px] font-bold text-white/20 uppercase leading-relaxed">
                    O número real de produtos pode variar dependendo da sobreposição entre as keywords selecionadas.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Presets Section */}
        {isRadar && (
          <div className="space-y-3">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/20 ml-1">Intensidade Operacional</span>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleUpdatePreset('aggressive')}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all",
                  currentPreset === 'aggressive'
                    ? "bg-kinetic-orange/10 border-kinetic-orange/40 shadow-glow-orange shadow-kinetic-orange/20"
                    : "bg-white/[0.02] border-white/5 hover:bg-white/5"
                )}
              >
                <Flame size={20} className={currentPreset === 'aggressive' ? "text-kinetic-orange" : "text-white/20"} />
                <span className={cn("text-[9px] font-black uppercase tracking-widest", currentPreset === 'aggressive' ? "text-white" : "text-white/20")}>
                  Agressivo
                </span>
              </button>

              <button
                onClick={() => handleUpdatePreset('balanced')}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all",
                  currentPreset === 'balanced'
                    ? "bg-blue-500/10 border-blue-500/40 shadow-glow-blue shadow-blue-500/20"
                    : "bg-white/[0.02] border-white/5 hover:bg-white/5"
                )}
              >
                <Scale size={20} className={currentPreset === 'balanced' ? "text-blue-400" : "text-white/20"} />
                <span className={cn("text-[9px] font-black uppercase tracking-widest", currentPreset === 'balanced' ? "text-white" : "text-white/20")}>
                  Balanceado
                </span>
              </button>

              <button
                onClick={() => handleUpdatePreset('conservative')}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all",
                  currentPreset === 'conservative'
                    ? "bg-emerald-500/10 border-emerald-500/40 shadow-glow-emerald shadow-emerald-500/20"
                    : "bg-white/[0.02] border-white/5 hover:bg-white/5"
                )}
              >
                <Target size={20} className={currentPreset === 'conservative' ? "text-emerald-400" : "text-white/20"} />
                <span className={cn("text-[9px] font-black uppercase tracking-widest", currentPreset === 'conservative' ? "text-white" : "text-white/20")}>
                  Conservador
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Advanced Config Toggle */}
        {isRadar && (
          <div className="pt-2">
            <button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-white/40 transition-colors"
            >
              {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Configurações Avançadas
            </button>
            
            {showAdvanced && (
              <div className="mt-4 p-4 rounded-2xl bg-deep-void/50 border border-white/5 space-y-4 animate-in slide-in-from-top-2 duration-300">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-white/30 uppercase">ID da Fonte</span>
                  <span className="text-[9px] font-mono text-white/20">{source.id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-white/30 uppercase">Última Varredura</span>
                  <span className="text-[9px] font-mono text-white/20">
                    {source.last_restock_at ? new Date(source.last_restock_at).toLocaleTimeString() : 'Nunca'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-bold text-white/30 uppercase">Próxima Página</span>
                  <span className="text-[9px] font-mono text-white/20">{source.discovery_page || 1}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {!isRadar && (
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-glow-emerald" />
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Monitoramento Ativo</span>
            </div>
            <Badge variant="outline" className="text-[9px] font-bold tracking-widest bg-white/5 border-white/10 opacity-60">
              ID: {source.channel_id?.slice(0, 8) || 'N/A'}
            </Badge>
          </div>
        )}
      </div>
    </TactileCard>
  );
}
