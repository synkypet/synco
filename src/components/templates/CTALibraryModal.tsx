import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Clock, TrendingUp, DollarSign, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CTALibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectHeader: (text: string) => void;
}

const CTA_DATA = [
  {
    category: 'Urgência',
    icon: Clock,
    color: 'text-orange-400',
    items: [
      '⏰ Corre que acaba rápido!',
      '🔥 Oferta por tempo LIMITADO!',
      '⏳ Só hoje até as 23:59!',
      '🏃‍♂️ Garanta o seu antes que esgote!',
      '🚨 Promoção relâmpago ativada!'
    ]
  },
  {
    category: 'Escassez',
    icon: TrendingUp,
    color: 'text-kinetic-orange',
    items: [
      '📦 Últimas unidades disponíveis!',
      '⚠️ Restam poucas unidades em estoque!',
      '📉 Menor preço histórico nas últimas 24h!',
      '💎 Item exclusivo em promoção hoje!'
    ]
  },
  {
    category: 'Economia',
    icon: DollarSign,
    color: 'text-emerald-400',
    items: [
      '💰 Melhor preço do mercado!',
      '🤑 Economize agora com este cupom!',
      '📉 Preço caiu! Aproveite o desconto!',
      '✔ Garantia de menor preço para você!'
    ]
  },
  {
    category: 'Prova Social',
    icon: Users,
    color: 'text-blue-400',
    items: [
      '🌟 Mais vendido da semana!',
      '⭐ Produto altamente recomendado!',
      '🚀 Campeão de vendas na categoria!',
      '👥 Milhares de pessoas já garantiram o delas!'
    ]
  }
];

export function CTALibraryModal({ isOpen, onClose, onSelectHeader }: CTALibraryModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-deep-void border-white/5 shadow-skeuo-elevated p-0 overflow-hidden animate-in zoom-in-95 duration-300">
        <DialogHeader className="p-6 border-b border-white/5 bg-gradient-to-br from-white/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-kinetic-orange/10 flex items-center justify-center shadow-skeuo-flat">
              <Sparkles className="w-5 h-5 text-kinetic-orange" />
            </div>
            <div>
              <DialogTitle className="text-sm font-black uppercase tracking-widest font-headline">Biblioteca de CTAs</DialogTitle>
              <p className="text-[10px] uppercase text-white/20 font-bold">Gatilhos mentais prontos para uso</p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-8 custom-scrollbar">
          {CTA_DATA.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.category} className="space-y-3">
                <div className="flex items-center gap-2 mb-4">
                  <Icon className={cn("w-3.5 h-3.5", section.color)} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{section.category}</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {section.items.map((item) => (
                    <button
                      key={item}
                      onClick={() => {
                        onSelectHeader(item);
                        onClose();
                      }}
                      className="w-full text-left p-3 rounded-xl bg-white/5 border border-transparent hover:border-kinetic-orange/20 hover:bg-kinetic-orange/5 transition-all text-xs text-white/70 hover:text-white group"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 bg-black/20 flex justify-end gap-3 border-t border-white/5">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="h-10 px-6 font-black text-[10px] uppercase tracking-widest text-white/40 hover:text-white"
          >
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
