'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/shared/PageHeader';
import LayoutContainer from '@/components/layout/LayoutContainer';
import { OperationalAccessBanner } from '@/components/billing/OperationalAccessBanner';
import { BadgePercent, Search, Zap, Loader2, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { KineticButton } from '@/components/ui/KineticButton';
import { Button } from '@/components/ui/button';
import { useShopeeOffers, ShopeeOffer } from '@/hooks/use-shopee-offers';
import { OffersGrid } from '@/components/radar-campanhas/OffersGrid';
import { CampaignProductsDrawer } from '@/components/radar-campanhas/CampaignProductsDrawer';
import { cn } from '@/lib/utils';

export default function RadarCampanhasPage() {
  const [searchInput, setSearchInput] = useState('');
  const [activeKeyword, setActiveKeyword] = useState<string | undefined>(undefined);
  const [filterType, setFilterType] = useState<'all' | 1 | 2>('all');
  const [selectedOffer, setSelectedOffer] = useState<ShopeeOffer | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, isFetching } = useShopeeOffers(activeKeyword);

  const handleSearch = () => {
    setActiveKeyword(searchInput.trim() || undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleManualRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['shopee-offers'] });
  };

  const filteredOffers = (data?.offers || []).filter(offer => {
    if (filterType === 'all') return true;
    return offer.offerType === filterType;
  });

  return (
    <LayoutContainer type="operational">
      <OperationalAccessBanner />
      
      {/* 1. Page Header */}
      <PageHeader
        title="Campanhas Shopee"
        description="Monitoramento automático de ofertas e campanhas especiais da Shopee."
        icon={<BadgePercent size={24} className="text-kinetic-orange" />}
        actions={
          <div className="flex items-center gap-3">
            <Link href="/radar-ofertas">
              <Button variant="ghost" className="h-11 px-6 bg-white/5 rounded-xl shadow-skeuo-flat border border-white/[0.02] hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest text-white/70">
                <ArrowLeft size={16} className="mr-2" />
                Voltar para Radar de Ofertas
              </Button>
            </Link>
          </div>
        }
      />

      {/* 2. Filtros e Busca */}
      <div className="space-y-6 mb-10">
        <div className="bg-anthracite-surface p-5 rounded-[32px] shadow-skeuo-flat border border-white/[0.02] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-kinetic-orange/20 to-transparent opacity-30" />
          
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            {/* Search Input */}
            <div className="relative flex-1 group w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/10 group-focus-within:text-kinetic-orange transition-colors" size={20} />
              <Input
                placeholder="Filtrar campanhas por palavra-chave (opcional)..."
                className="pl-12 h-14 bg-deep-void border-none shadow-skeuo-pressed rounded-2xl text-[13px] font-bold tracking-tight text-white/90 placeholder:text-white/10 focus-visible:ring-1 focus-visible:ring-kinetic-orange/20"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            
            <div className="flex items-center gap-3 w-full lg:w-auto">
              <KineticButton 
                onClick={handleSearch} 
                disabled={isFetching}
                className="h-14 px-10 rounded-2xl font-black text-[10px] uppercase tracking-widest min-w-[160px]"
              >
                {isFetching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                {isFetching ? 'Buscando' : 'Filtrar'}
              </KineticButton>
              
              <Button
                variant="ghost"
                onClick={handleManualRefresh}
                disabled={isFetching}
                className={cn(
                  "h-14 w-14 rounded-2xl bg-white/5 border border-white/[0.02] shadow-skeuo-flat hover:bg-white/10 transition-all p-0 flex items-center justify-center",
                  isFetching && "opacity-50 cursor-not-allowed"
                )}
                title="Sincronizar Manualmente"
              >
                <Zap size={20} className={cn("text-kinetic-orange", isFetching && "animate-pulse")} />
              </Button>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
             <div className="flex items-center gap-2 bg-deep-void p-1 rounded-xl shadow-skeuo-pressed w-full md:w-auto overflow-x-auto scrollbar-hide">
                <Button
                  variant="ghost"
                  onClick={() => setFilterType('all')}
                  className={cn(
                    "h-10 px-6 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap",
                    filterType === 'all' 
                      ? "bg-kinetic-orange text-white shadow-glow-orange-intense" 
                      : "text-white/40 hover:text-white hover:bg-white/5"
                  )}
                >
                  Todas
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setFilterType(1)}
                  className={cn(
                    "h-10 px-6 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap",
                    filterType === 1 
                      ? "bg-kinetic-orange text-white shadow-glow-orange-intense" 
                      : "text-white/40 hover:text-white hover:bg-white/5"
                  )}
                >
                  Coleções
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setFilterType(2)}
                  className={cn(
                    "h-10 px-6 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap",
                    filterType === 2 
                      ? "bg-kinetic-orange text-white shadow-glow-orange-intense" 
                      : "text-white/40 hover:text-white hover:bg-white/5"
                  )}
                >
                  Categorias
                </Button>
             </div>

             <div className="flex items-center gap-4">
               <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/40 hidden sm:inline-block">Sincronização Ativa</span>
               </div>
               
               {data?.testedAt && (
                  <span className="text-[9px] font-bold uppercase text-white/20">
                    Última att: {new Date(data.testedAt).toLocaleTimeString('pt-BR')}
                  </span>
               )}
             </div>
          </div>
        </div>
      </div>

      {/* 3. Grid de Ofertas */}
      <OffersGrid 
        offers={filteredOffers} 
        isLoading={isLoading} 
        isError={isError} 
        error={error} 
        onRetry={handleManualRefresh} 
        onOfferClick={setSelectedOffer}
      />
      
      <CampaignProductsDrawer 
        offer={selectedOffer} 
        onClose={() => setSelectedOffer(null)} 
      />
      
    </LayoutContainer>
  );
}
