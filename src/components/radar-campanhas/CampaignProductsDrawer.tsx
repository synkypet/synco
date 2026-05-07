import React from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Copy, AlertCircle, ShoppingBag, SearchX } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { KineticButton } from '@/components/ui/KineticButton';
import { TactileCard } from '@/components/ui/TactileCard';
import { Skeleton } from '@/components/ui/skeleton';
import { ShopeeOffer } from '@/hooks/use-shopee-offers';
import { useCampaignProducts, CampaignProduct } from '@/hooks/use-campaign-products';
import { extractOfferName, formatCurrency, formatPercent } from '@/lib/utils';

interface CampaignProductsDrawerProps {
  offer: ShopeeOffer | null;
  onClose: () => void;
}

export function CampaignProductsDrawer({ offer, onClose }: CampaignProductsDrawerProps) {
  const keyword = offer ? extractOfferName(offer.offerName) : null;
  const { products, isLoading, isError, error, refetch } = useCampaignProducts(keyword);

  const handleCopyLink = (product: CampaignProduct) => {
    if (product.offerLink) {
      navigator.clipboard.writeText(product.offerLink);
      toast.success('Link de afiliado do produto copiado!');
    } else {
      toast.error('Link não disponível para este produto.');
    }
  };

  return (
    <Dialog open={!!offer} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="w-full sm:max-w-2xl bg-deep-void p-0 flex flex-col max-h-[90vh] overflow-hidden rounded-[32px] border border-white/5"
      >
        <DialogHeader className="p-6 border-b border-white/[0.05] bg-anthracite-surface/50 shrink-0">
          <div className="flex items-center gap-4">
            {offer?.imageUrl ? (
              <div className="relative w-16 h-16 rounded-xl overflow-hidden shadow-skeuo-flat shrink-0 border border-white/5">
                <Image src={offer.imageUrl} alt={keyword || ''} fill className="object-cover" unoptimized />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
                <ShoppingBag className="text-white/20" size={24} />
              </div>
            )}
            
            <div className="flex flex-col items-start gap-2">
              <DialogTitle className="text-lg font-black text-white/90 text-left line-clamp-2">
                {keyword}
              </DialogTitle>
              <Badge className="bg-kinetic-orange text-white border-none shadow-glow-orange font-black text-[10px] tracking-widest uppercase px-2 h-6">
                {offer?.commissionPercent}% de Comissão Base
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {isLoading && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.02]">
                  <Skeleton className="w-20 h-20 rounded-xl shrink-0 bg-white/5" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full bg-white/5" />
                    <Skeleton className="h-4 w-3/4 bg-white/5" />
                    <Skeleton className="h-8 w-full mt-2 rounded-xl bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {isError && (
             <div className="p-10 text-center bg-red-500/5 rounded-3xl shadow-skeuo-pressed border border-red-500/10">
                <AlertCircle size={32} className="text-red-500 mx-auto mb-4" />
                <h3 className="text-sm font-black uppercase tracking-widest text-white/90 mb-2">Erro na Busca</h3>
                <p className="text-white/40 text-[11px] mb-6">{error?.message || "Erro desconhecido."}</p>
                <KineticButton onClick={() => refetch()} className="px-6 h-10 rounded-xl bg-red-500/10 text-red-500 text-[10px]">
                  Tentar Novamente
                </KineticButton>
             </div>
          )}

          {!isLoading && !isError && products.length === 0 && (
             <div className="p-16 text-center bg-anthracite-surface/40 rounded-[32px] shadow-skeuo-pressed border border-white/[0.01]">
               <SearchX size={40} className="text-white/10 mx-auto mb-6" />
               <h3 className="text-base font-black uppercase tracking-widest text-white/20 mb-2">Nenhum Produto</h3>
               <p className="text-white/10 text-[10px] font-bold uppercase tracking-widest">Nenhum produto encontrado para esta campanha.</p>
             </div>
          )}

          {!isLoading && !isError && products.length > 0 && (() => {
            const qualityProducts = products.filter(p => p.sales >= 100);
            const displayProducts = qualityProducts.length > 0 ? qualityProducts : products;

            return (
              <>
                {qualityProducts.length === 0 && products.length > 0 && (
                  <div className="mb-4 px-4 py-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                    <p className="text-[9px] font-black uppercase tracking-widest text-yellow-500/50">
                      Produtos com volume de vendas limitado para esta campanha
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-10">
                  {displayProducts.map((product, idx) => (
                    <TactileCard key={`${product.productName}-${idx}`} className="p-3 flex gap-3 h-full hover:border-kinetic-orange/20 transition-colors group">
                      <div className="relative w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-white/5 border border-white/5">
                        {product.imageUrl ? (
                          <Image src={product.imageUrl} alt={product.productName || ''} fill className="object-cover group-hover:scale-105 transition-transform" unoptimized />
                        ) : (
                          <ShoppingBag className="absolute inset-0 m-auto text-white/10" size={24} />
                        )}
                      </div>
                      
                      <div className="flex flex-col flex-1 min-w-0 py-1">
                        <h4 className="text-xs font-bold text-white/90 line-clamp-2 leading-snug mb-0.5" title={product.productName || ''}>
                          {product.productName}
                        </h4>

                        {product.sales > 0 && (
                          <span className="text-[9px] text-white/30 font-bold uppercase tracking-widest mb-auto">
                            {product.sales >= 1000 
                              ? `${(product.sales / 1000).toFixed(1)}k+ vendidos`
                              : `${product.sales}+ vendidos`}
                          </span>
                        )}
                        
                        <div className="flex items-end justify-between mt-2 gap-2">
                          <div className="flex flex-col">
                            {product.originalPriceParsed > 0 && (
                              <span className="text-[10px] text-white/30 font-bold line-through">
                                {formatCurrency(product.originalPriceParsed)}
                              </span>
                            )}
                            <span className="text-[13px] font-black text-kinetic-orange">
                              {formatCurrency(product.priceParsed)}
                            </span>
                          </div>
                          
                          <div className="flex gap-1 flex-wrap justify-end">
                            {product.priceDiscountRate > 0 && (
                              <Badge className="h-5 px-1.5 text-[9px] bg-red-500/20 text-red-400 border-none font-black uppercase tracking-widest">
                                -{product.priceDiscountRate}%
                              </Badge>
                            )}
                            <Badge className="h-5 px-1.5 text-[9px] bg-white/10 text-white/60 border-none font-bold uppercase tracking-widest">
                              {formatPercent(product.commissionPercent)}
                            </Badge>
                          </div>
                        </div>

                        <KineticButton 
                          onClick={() => handleCopyLink(product)}
                          className="w-full mt-3 h-8 rounded-lg text-[9px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 text-white/60 border border-white/[0.05]"
                        >
                          <Copy size={12} className="mr-1.5" />
                          Copiar
                        </KineticButton>
                      </div>
                    </TactileCard>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
