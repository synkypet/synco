'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Copy, Calendar, Tag, ExternalLink, Image as ImageIcon, Zap } from 'lucide-react';
import { TactileCard } from '@/components/ui/TactileCard';
import { KineticButton } from '@/components/ui/KineticButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShopeeOffer } from '@/hooks/use-shopee-offers';
import { cn, extractOfferName } from '@/lib/utils';
import Image from 'next/image';

interface OfferCardProps {
  offer: ShopeeOffer;
  onClick?: () => void;
}

export function OfferCard({ offer, onClick }: OfferCardProps) {
  const router = useRouter();
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

  const handleQuickSend = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!offer.offerLink) {
      toast.error('Link não disponível para disparo.');
      return;
    }

    const payload = {
      link: offer.offerLink,
      image: offer.imageUrl,
      title: cleanName,
      commission: offer.commissionPercent,
      origin: 'coupon_shopee'
    };

    // Usar encodeURIComponent + stringify para segurança na URL
    const encodedData = encodeURIComponent(JSON.stringify(payload));
    router.push(`/envio-rapido?coupon=${encodedData}`);
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
            sizes="(max-width: 768px) 100vw, 400px"
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
          onClick={handleQuickSend}
          className="flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest bg-kinetic-orange shadow-glow-orange border-none text-white hover:bg-kinetic-orange/80"
        >
          <Zap size={14} className="mr-2" />
          Disparar
        </KineticButton>

        <Button 
          variant="ghost"
          onClick={handleCopyLink}
          className="h-10 px-4 rounded-xl bg-white/5 border border-white/5 text-white/40 hover:bg-white/10 hover:text-white transition-all"
        >
          <Copy size={14} />
        </Button>
        
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
