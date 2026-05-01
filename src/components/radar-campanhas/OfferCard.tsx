import React from 'react';
import { toast } from 'sonner';
import { Copy, Calendar, Tag, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { TactileCard } from '@/components/ui/TactileCard';
import { KineticButton } from '@/components/ui/KineticButton';
import { Badge } from '@/components/ui/badge';
import { ShopeeOffer } from '@/hooks/use-shopee-offers';
import { cn, extractOfferName } from '@/lib/utils';
import Image from 'next/image';

interface OfferCardProps {
  offer: ShopeeOffer;
  onClick?: () => void;
}

export function OfferCard({ offer, onClick }: OfferCardProps) {
  const cleanName = extractOfferName(offer.offerName);

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (offer.offerLink) {
      navigator.clipboard.writeText(offer.offerLink);
      toast.success('Link de afiliado copiado!');
    } else {
      toast.error('Link não disponível para esta oferta.');
    }
  };

  return (
    <div onClick={onClick} className={cn("h-full", onClick && "cursor-pointer")}>
      <TactileCard className={cn("h-full flex flex-col p-4 gap-4 overflow-hidden group", onClick && "hover:border-kinetic-orange/30 transition-colors")}>
      {/* Imagem Area */}
      <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-white/5 border border-white/5">
        {offer.imageUrl ? (
          <Image
            src={offer.imageUrl}
            alt={offer.offerName}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/10">
            <ImageIcon size={48} className="mb-2 opacity-50" />
            <span className="text-[10px] font-black uppercase tracking-widest">Sem Imagem</span>
          </div>
        )}
        
        {/* Badge Flutuante - Comissão */}
        <div className="absolute top-3 left-3">
          <Badge className="bg-kinetic-orange text-white border-none shadow-glow-orange font-black text-[10px] tracking-widest uppercase h-7 px-3">
            {offer.commissionPercent}% de Comissão
          </Badge>
        </div>
      </div>

      {/* Conteúdo Area */}
      <div className="flex flex-col flex-1 gap-3">
        <h3 className="text-sm font-bold leading-snug text-white/90 line-clamp-2" title={cleanName}>
          {cleanName}
        </h3>

        <div className="flex flex-wrap gap-2 mt-auto">
          {offer.periodEndFormatted && (
            <Badge variant="outline" className="border-white/10 text-white/40 text-[9px] font-black uppercase tracking-widest px-2 h-6 flex items-center gap-1.5">
              <Calendar size={10} />
              Válido até {offer.periodEndFormatted}
            </Badge>
          )}
          
          <Badge variant="outline" className="border-white/10 text-white/40 text-[9px] font-black uppercase tracking-widest px-2 h-6 flex items-center gap-1.5">
            <Tag size={10} />
            {offer.offerType === 1 ? 'Coleção' : offer.offerType === 2 ? 'Categoria' : 'Oferta'}
          </Badge>
        </div>
      </div>

      {/* Ações Area */}
      <div className="pt-3 border-t border-white/5 flex gap-2">
        <KineticButton 
          onClick={handleCopyLink}
          className="flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest"
        >
          <Copy size={14} className="mr-2" />
          Copiar Link
        </KineticButton>
        
        {offer.originalLink && (
          <a href={offer.originalLink} target="_blank" rel="noopener noreferrer" className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <TactileCard className="w-10 h-10 p-0 flex items-center justify-center bg-white/5 border-none hover:bg-white/10 transition-colors">
              <ExternalLink size={16} className="text-white/40" />
            </TactileCard>
          </a>
        )}
      </div>
    </TactileCard>
    </div>
  );
}
