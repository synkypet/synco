'use client';

import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Database
} from 'lucide-react';
import { TactileCard } from '@/components/ui/TactileCard';
import { KineticButton } from '@/components/ui/KineticButton';
import { cn } from '@/lib/utils';
import { useShopeeParser } from '@/hooks/use-shopee-parser';
import { earningsService } from '@/services/supabase/earnings-service';
import { useAuth } from '@/contexts/AuthContext';

interface ImportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function ImportDrawer({ isOpen, onClose, onImportComplete }: ImportDrawerProps) {
  const { user } = useAuth();
  const { parseCSV, isParsing, error: parseError } = useShopeeParser();
  
  const [step, setStep] = useState<'upload' | 'preview' | 'processing' | 'success'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [parsedData, setParsedData] = useState<any[]>([]);

  const handleProcess = async () => {
    if (!file || !user) return;
    setStep('processing');
    
    try {
      // 1. Criar Lote
      const batch = await earningsService.createBatch({
        user_id: user.id,
        filename: file.name,
        status: 'processing',
        total_rows: parsedData.length
      });

      // 2. Persistir Ordens
      await earningsService.upsertOrders(batch.id, parsedData.map(o => ({ ...o, user_id: user.id })));

      // 3. Finalizar Lote
      await earningsService.updateBatchStatus(batch.id, { 
        status: 'completed',
        inserted_count: parsedData.length // No MVP assumimos sucesso, depois refinamos counts
      });

      setStep('success');
      setTimeout(() => {
        onImportComplete();
        reset();
      }, 2000);
    } catch (err) {
      console.error('Falha na importação:', err);
      setStep('preview');
    }
  };

  const reset = () => {
    setFile(null);
    setParsedData([]);
    setStep('upload');
  };

  const handleFileUpload = async (selectedFile: File) => {
    setFile(selectedFile);
    try {
      const data = await parseCSV(selectedFile);
      setParsedData(data);
      setStep('preview');
    } catch (err) {
      console.error('Erro no parse:', err);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  if (!isOpen) return null;

  // Cálculos de Preview
  const totalCommission = parsedData.reduce((acc, curr) => acc + (curr.estimated_commission || 0), 0);
  const totalAmount = parsedData.reduce((acc, curr) => acc + (curr.checkout_amount || 0), 0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-end">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <aside className={cn(
        "relative w-full max-w-xl h-full bg-anthracite-surface shadow-[-20px_0_60px_rgba(0,0,0,0.5)]",
        "flex flex-col animate-in slide-in-from-right duration-500 ease-out"
      )}>
        {/* Header */}
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-kinetic-orange/10 rounded-xl flex items-center justify-center text-kinetic-orange">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight font-headline">
                Importar Ganhos
              </h2>
              <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">
                Relatório Shopee (.csv)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white/20 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {step === 'upload' && (
            <div className="space-y-6 mt-12">
              <div 
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={cn(
                  "relative h-[300px] rounded-3xl flex flex-col items-center justify-center text-center p-8 transition-all duration-300 cursor-pointer overflow-hidden",
                  "border-2 border-dashed border-white/5 bg-white/[0.02]",
                  dragActive ? "border-kinetic-orange/50 bg-kinetic-orange/5" : "hover:border-white/10 hover:bg-white/[0.04]"
                )}
              >
                {isParsing ? (
                   <Loader2 className="w-12 h-12 text-kinetic-orange animate-spin mb-6" />
                ) : (
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                    <FileText className="w-10 h-10 text-white/20" />
                  </div>
                )}
                <div className="space-y-2">
                  <h3 className="text-white/80 font-bold">{isParsing ? 'Analisando arquivo...' : 'Arraste seu relatório aqui'}</h3>
                  <p className="text-white/30 text-sm">ou clique para selecionar o arquivo</p>
                </div>
                <input 
                  type="file" 
                  accept=".csv"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
              </div>

              {parseError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex gap-3 text-red-500">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-xs font-bold uppercase tracking-tight">{parseError}</p>
                </div>
              )}

              {/* Dica */}
              <div className="bg-white/5 rounded-2xl p-4 flex gap-4">
                <AlertCircle className="w-5 h-5 text-kinetic-orange flex-shrink-0" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white/80 uppercase">Como baixar o relatório?</h4>
                  <p className="text-[11px] text-white/40 leading-relaxed">
                    No Portal de Afiliados Shopee, acesse <strong>Relatórios {'>'} Relatório de Vendas</strong>, escolha o período e clique em <strong>Exportar (CSV)</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && file && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
              <TactileCard className="p-6 bg-emerald-500/5 border border-emerald-500/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-tight">Análise Concluída</h3>
                    <p className="text-xs text-white/40">{file.name} pronta para sincronização.</p>
                  </div>
                </div>
              </TactileCard>

              {/* Resumo da Análise Real */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] px-1">Resumo Detectado</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-2xl p-4">
                    <span className="block text-[10px] text-white/30 uppercase font-black tracking-widest mb-1">Itens/Pedidos</span>
                    <span className="text-xl font-black text-white font-headline">{parsedData.length}</span>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4">
                    <span className="block text-[10px] text-white/30 uppercase font-black tracking-widest mb-1">Comissão Total</span>
                    <span className="text-xl font-black text-emerald-500 font-headline">
                      R$ {totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <div className="bg-white/5 rounded-2xl p-4">
                  <span className="block text-[10px] text-white/30 uppercase font-black tracking-widest mb-1">Volume de Vendas (Checkout)</span>
                  <span className="text-xl font-black text-white font-headline">
                    R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="pt-8 space-y-3">
                <KineticButton 
                  onClick={handleProcess}
                  className="w-full text-sm py-4"
                >
                  Confirmar e Processar Ganhos
                </KineticButton>
                <button 
                  onClick={reset}
                  className="w-full py-3 text-white/20 text-xs font-bold uppercase tracking-widest hover:text-white transition-all"
                >
                  Selecionar outro arquivo
                </button>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-in fade-in zoom-in-95 duration-500">
              <Loader2 className="w-12 h-12 text-kinetic-orange animate-spin mb-6" />
              <h3 className="text-xl font-black text-white uppercase font-headline tracking-tight">Sincronizando com Banco</h3>
              <p className="text-white/40 text-sm mt-2 max-w-xs">
                Estamos aplicando as regras de unicidade e atualizando os status dos pedidos.
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 text-emerald-500">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-white uppercase font-headline tracking-tight">Importação Concluída!</h3>
              <p className="text-white/40 text-sm mt-2">
                Os dados financeiros reais foram atualizados com sucesso.
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
