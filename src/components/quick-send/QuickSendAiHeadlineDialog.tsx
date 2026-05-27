import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { KineticButton } from '@/components/ui/KineticButton';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { ProductSnapshot } from '@/lib/linkProcessor';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface QuickSendAiHeadlineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductSnapshot[];
  onGenerate: (selectedProductIds: string[], instruction: string) => Promise<void>;
  isGenerating: boolean;
}

export function QuickSendAiHeadlineDialog({
  open,
  onOpenChange,
  products,
  onGenerate,
  isGenerating
}: QuickSendAiHeadlineDialogProps) {
  const [instruction, setInstruction] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>(products.map(p => p.id));
  const [showConfirm, setShowConfirm] = useState(false);

  // Update default selected when products change
  React.useEffect(() => {
    if (open && !showConfirm) {
      setSelectedIds(products.map(p => p.id));
      setInstruction('');
    }
  }, [open, products]);

  const handleToggleProduct = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleGenerateClick = () => {
    if (selectedIds.length === 0) {
      toast.error('Selecione pelo menos um produto.');
      return;
    }
    if (!instruction.trim()) {
      setShowConfirm(true);
      return;
    }
    onGenerate(selectedIds, instruction);
    onOpenChange(false);
  };

  const handleConfirmNoInstruction = () => {
    setShowConfirm(false);
    onGenerate(selectedIds, '');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) setShowConfirm(false);
      onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-[425px] bg-anthracite-surface border border-white/10 shadow-skeuo-elevated text-white rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-black uppercase tracking-widest text-sm italic">
            <Sparkles className="w-4 h-4 text-kinetic-orange" />
            Gerar headlines com IA
          </DialogTitle>
        </DialogHeader>

        {!showConfirm ? (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/50 block">
                Diga o tema ou estilo que a IA deve seguir (opcional)
              </label>
              <Input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Ex: Dia dos Namorados, engraçado..."
                className="bg-deep-void border-none shadow-skeuo-pressed text-sm h-11"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/50 block">
                Produtos selecionados ({selectedIds.length}/{products.length})
              </label>
              <div className="max-h-[200px] overflow-y-auto space-y-2 custom-scrollbar pr-2">
                {products.map(p => (
                  <div key={p.id} className="flex items-center gap-3 bg-deep-void/50 p-2 rounded-xl">
                    <Checkbox
                      checked={selectedIds.includes(p.id)}
                      onCheckedChange={() => handleToggleProduct(p.id)}
                      className="border-white/20 data-[state=checked]:bg-kinetic-orange data-[state=checked]:border-none"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black uppercase tracking-tight truncate text-white/90">
                        {p.factual.title || 'Produto sem título'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="h-10 px-4 text-[10px]"
              >
                Cancelar
              </Button>
              <KineticButton
                onClick={handleGenerateClick}
                disabled={selectedIds.length === 0 || isGenerating}
                className="h-10 px-6 text-[10px]"
              >
                {isGenerating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  'Gerar para selecionados'
                )}
              </KineticButton>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="p-4 bg-kinetic-orange/10 rounded-xl border border-kinetic-orange/20 text-sm text-white/90 leading-relaxed">
              Você não escreveu uma instrução. A IA vai usar o estilo padrão SYNCO: headline curta, em caixa alta, vendedora, informal e baseada no produto/preço. Deseja continuar?
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setShowConfirm(false)}
                className="h-10 px-4 text-[10px]"
              >
                Voltar
              </Button>
              <KineticButton
                onClick={handleConfirmNoInstruction}
                className="h-10 px-6 text-[10px]"
              >
                Sim, continuar
              </KineticButton>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
