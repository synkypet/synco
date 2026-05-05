import React from 'react';
import { CouponCard } from './CouponCard';
import { ShopeeOffer } from '@/hooks/use-shopee-offers';
import { AlertCircle, Tag, SearchX } from 'lucide-react';
import { KineticButton } from '@/components/ui/KineticButton';

interface OffersGridProps {
  offers: ShopeeOffer[];
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry: () => void;
  onOfferClick: (offer: ShopeeOffer) => void;
}

export function OffersGrid({ offers, isLoading, isError, error, onRetry, onOfferClick }: OffersGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-[380px] bg-white/[0.02] rounded-3xl shadow-skeuo-flat animate-pulse flex flex-col p-4 gap-4 border border-white/[0.02]">
             <div className="w-full aspect-square bg-white/5 rounded-2xl" />
             <div className="w-3/4 h-4 bg-white/5 rounded-full" />
             <div className="w-1/2 h-4 bg-white/5 rounded-full" />
             <div className="w-full h-10 mt-auto bg-white/5 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-16 text-center bg-red-500/5 rounded-[40px] shadow-skeuo-pressed border border-red-500/10 max-w-3xl mx-auto animate-in fade-in zoom-in-95 duration-500">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-skeuo-elevated">
          <AlertCircle size={40} className="text-red-500" />
        </div>
        <h3 className="text-xl font-black uppercase tracking-[0.2em] text-white/90 font-headline italic">Falha de Sincronização</h3>
        <p className="text-white/40 mt-4 max-w-md mx-auto font-bold text-[11px]">
          {error?.message || "Não foi possível carregar as campanhas da Shopee no momento."}
        </p>
        <KineticButton onClick={onRetry} className="mt-8 px-8 h-12 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 border-none">
          Tentar Novamente
        </KineticButton>
      </div>
    );
  }

  const validOffers = (offers || []).filter(offer => 
    offer.imageUrl && offer.imageUrl.trim() !== ''
  );

  if (validOffers.length === 0) {
    return (
      <div className="p-20 text-center bg-anthracite-surface/40 rounded-[48px] shadow-skeuo-pressed border border-white/[0.01] max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-500">
        <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 shadow-skeuo-elevated">
          <SearchX size={48} className="text-white/10" />
        </div>
        <h3 className="text-2xl font-black uppercase tracking-[0.2em] text-white/20 font-headline italic">Nenhuma Campanha</h3>
        <p className="text-white/10 mt-4 leading-relaxed max-w-sm mx-auto font-bold uppercase text-[9px] tracking-[0.3em]">
          Nenhuma campanha ativa encontrada para estes parâmetros no momento.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-700">
      {validOffers.map((offer, index) => (
        <div key={`${offer.offerName}-${index}`} className="animate-in fade-in zoom-in-95 duration-500" style={{ animationDelay: `${index * 50}ms` }}>
          <CouponCard offer={offer} onClick={() => onOfferClick(offer)} />
        </div>
      ))}
    </div>
  );
}
