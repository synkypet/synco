'use client';

import React from 'react';
import { Zap, Calendar, Tag, ExternalLink, Info } from 'lucide-react';
import { KineticButton } from '@/components/ui/KineticButton';
import { Badge } from '@/components/ui/badge';
import { ShopeeOffer } from '@/hooks/use-shopee-offers';
import { cn, extractOfferName } from '@/lib/utils';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface CouponCardProps {
  offer: ShopeeOffer;
  onClick?: () => void;
  hideCommission?: boolean;
  showImage?: boolean;
}

export const CouponCard: React.FC<CouponCardProps> = ({ 
  offer, 
  onClick, 
  hideCommission,
  showImage = true 
}) => {
  const router = useRouter();
  const cleanName = extractOfferName(offer.offerName);

  const handleQuickDispatch = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Payload para o Envio Rápido via URL
    const payload = {
      title: cleanName,
      link: offer.offerLink,
      image: showImage ? offer.imageUrl : undefined,
      commission: hideCommission ? 'RESGATE' : offer.commissionPercent.toFixed(1)
    };

    const encoded = encodeURIComponent(JSON.stringify(payload));
    router.push(`/envio-rapido?coupon=${encoded}`);
    
    toast.success('Preparando disparo do cupom...', {
      description: 'Redirecionando para o Envio Rápido.',
      icon: <Zap className="text-kinetic-orange" size={16} />
    });
  };

  return (
    <div className="group relative cursor-pointer" onClick={onClick}>
      {/* Container Principal com Estética de Ticket */}
      <div 
        className={cn(
          "relative bg-anthracite-surface rounded-2xl overflow-hidden shadow-skeuo-flat border border-white/[0.03] transition-all duration-300 group-hover:shadow-glow-orange/5 group-hover:translate-y-[-2px]",
          !showImage && "pt-6"
        )}
        style={{
          maskImage: 'radial-gradient(circle at 0px 50%, transparent 12px, black 12px), radial-gradient(circle at 100% 50%, transparent 12px, black 12px)',
          WebkitMaskImage: 'radial-gradient(circle at 0px 50%, transparent 12px, black 12px), radial-gradient(circle at 100% 50%, transparent 12px, black 12px)',
          maskComposite: 'intersect',
          WebkitMaskComposite: 'source-in'
        }}
      >
        {/* Banner da Campanha (Opcional) */}
        {showImage && (
          <div className="relative h-32 w-full overflow-hidden bg-deep-void/50">
            <img 
              src={offer.imageUrl || 'https://vgzcisazfsamfkrhuvhy.supabase.co/storage/v1/object/public/assets/shopee-coupon-placeholder.png'} 
              alt={cleanName}
              className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-anthracite-surface via-transparent to-transparent" />
            
            {/* Badge de Tipo */}
            <div className="absolute top-3 left-4">
              <Badge className="bg-kinetic-orange/20 text-kinetic-orange border-none text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full backdrop-blur-md">
                {hideCommission ? 'Resgate' : (offer.offerType === 1 ? 'Coleção' : 'Categoria')}
              </Badge>
            </div>
          </div>
        )}

        {/* Corpo do Cupom */}
        <div className={cn("p-5 relative", showImage ? "pt-2" : "pt-4")}>
          {/* Linha Pontilhada de Recorte */}
          <div className="absolute -top-1 left-0 w-full flex justify-center px-4 overflow-hidden opacity-20">
            <div className="w-full border-t-2 border-dashed border-white/50" />
          </div>

          {!showImage && (
            <div className="mb-4">
              <Badge className="bg-kinetic-orange/20 text-kinetic-orange border-none text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                {hideCommission ? 'Resgate Prioritário' : 'Oferta Direta'}
              </Badge>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {/* Header: Nome e Valor */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h4 className="text-[11px] font-black text-white/90 uppercase tracking-wider leading-tight line-clamp-2 min-h-[32px]">
                  {cleanName}
                </h4>
                <div className="flex items-center gap-2 mt-2 text-white/30">
                  <Calendar size={10} className="text-kinetic-orange" />
                  <span className="text-[9px] font-bold uppercase tracking-widest">
                    {hideCommission ? 'Disponível Agora' : `Validade: ${offer.periodEndFormatted || 'Indeterminada'}`}
                  </span>
                </div>
              </div>

              {/* Destaque de Comissão ou Badge de Resgate */}
              <div className="flex flex-col items-end shrink-0">
                {!hideCommission ? (
                  <>
                    <div className="text-2xl font-black font-headline italic text-kinetic-orange leading-none">
                      {offer.commissionPercent.toFixed(1)}%
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/20 mt-1">COMISSÃO</span>
                  </>
                ) : (
                  <div className="px-3 py-1.5 bg-kinetic-orange/10 border border-kinetic-orange/20 rounded-lg">
                    <span className="text-[9px] font-black uppercase tracking-widest text-kinetic-orange">Cupom Real</span>
                  </div>
                )}
              </div>
            </div>

            {/* Ações Tácticas */}
            <div className="flex items-center gap-2 mt-2">
              <KineticButton 
                onClick={handleQuickDispatch}
                className="flex-1 h-11 rounded-xl bg-kinetic-orange/10 text-kinetic-orange hover:bg-kinetic-orange/20 border-none group/btn"
              >
                <Zap size={14} className="mr-2 group-hover/btn:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Disparar</span>
              </KineticButton>
              
              <a 
                href={offer.offerLink} 
                target="_blank" 
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="h-11 w-11 flex items-center justify-center rounded-xl bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all shadow-skeuo-flat border border-white/[0.02]"
                title="Ver página da oferta"
              >
                <ExternalLink size={16} />
              </a>
            </div>
          </div>
        </div>

        {/* Efeito de Gloss Inferior */}
        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-kinetic-orange/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Sombras Laterais de Ticket (Entradas circulares) */}
      <div className="absolute top-1/2 -left-1.5 w-3 h-6 bg-deep-void rounded-full -translate-y-1/2 z-10 shadow-inner" />
      <div className="absolute top-1/2 -right-1.5 w-3 h-6 bg-deep-void rounded-full -translate-y-1/2 z-10 shadow-inner" />
    </div>
  );
};
