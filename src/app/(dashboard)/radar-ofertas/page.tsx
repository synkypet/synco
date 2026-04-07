// src/app/(dashboard)/radar-ofertas/page.tsx
'use client';

import React, { useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KineticButton } from '@/components/ui/KineticButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Zap, 
  ShoppingCart, 
  Search, 
  LayoutGrid, 
  List, 
  ArrowUpDown,
  Loader2,
  AlertCircle,
  SlidersHorizontal,
  SendHorizonal,
  CheckSquare,
  X
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuLabel, 
  DropdownMenuRadioGroup, 
  DropdownMenuRadioItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useProducts, useToggleFavorite } from '@/hooks/use-products';
import { useSelectedProducts } from '@/contexts/SelectedProductsContext';
import ProductCard from '@/components/radar/ProductCard';
import RadarFilters from '@/components/radar/RadarFilters';
import { MARKETPLACE_TABS, OFFER_TABS, SORT_OPTIONS } from '@/lib/constants';
import { ProductFilter } from '@/types/product';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function RadarOfertasPage() {
  // State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [marketplace, setMarketplace] = useState('all');
  const [offerType, setOfferType] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('score_desc');
  const [filters, setFilters] = useState<ProductFilter>({});
  const [showFilters, setShowFilters] = useState(false);

  // Context & Hooks
  const { toggleProduct, isSelected, count: cartCount, selectedProducts, clearProducts } = useSelectedProducts();
  const toggleFavoriteMutation = useToggleFavorite();
  
  // Data Fetching
  const { data: products, isLoading, isError, error } = useProducts({
    ...filters,
    marketplace: marketplace === 'all' ? undefined : marketplace,
    search: search || undefined,
  });

  const handleResetFilters = () => {
    setFilters({});
    setSearch('');
    setMarketplace('all');
    setOfferType('all');
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <PageHeader
        title="Radar de Ofertas"
        description="Monitore e selecione as melhores oportunidades dos marketplaces em tempo real."
        actions={
          <div className="flex items-center gap-3">
            {/* Toggle Filtros — Base44 pattern */}
            <Button 
              variant="ghost" 
              size="sm"
              className={cn(
                "h-10 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                showFilters 
                  ? "bg-kinetic-orange/10 text-kinetic-orange shadow-skeuo-pressed" 
                  : "bg-white/5 text-white/50 hover:text-white shadow-skeuo-flat"
              )}
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Filtros
            </Button>

            {/* Enviar selecionados — Base44 pattern */}
            {selectedProducts.length > 0 && (
              <Link href="/envio-rapido">
                <KineticButton className="h-10 px-6">
                  <SendHorizonal className="w-4 h-4 mr-2" />
                  Enviar selecionados ({selectedProducts.length})
                </KineticButton>
              </Link>
            )}

            {/* Carrinho */}
            <Link href="/carrinho-ofertas">
              <Button 
                variant="ghost" 
                size="sm"
                className="relative h-10 px-4 text-[10px] font-black uppercase tracking-widest bg-white/5 text-white/50 hover:text-white rounded-xl shadow-skeuo-flat"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Carrinho
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-deep-void shadow-sm">
                    {cartCount}
                  </span>
                )}
              </Button>
            </Link>
          </div>
        }
      />

      {/* Toolbar & Tabs — Refactored for better responsiveness to prevent horizontal overflow */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-1">
          <Tabs value={marketplace} onValueChange={setMarketplace} className="w-full lg:w-auto overflow-x-auto no-scrollbar pb-1">
            <TabsList className="bg-deep-void shadow-skeuo-pressed p-1.5 h-12 rounded-2xl border-none min-w-max">
              {MARKETPLACE_TABS.map(tab => (
                <TabsTrigger 
                  key={tab.value} 
                  value={tab.value}
                  className="px-6 text-[10px] font-black uppercase tracking-widest transition-all duration-300 data-[state=active]:bg-white/5 data-[state=active]:text-kinetic-orange data-[state=active]:shadow-skeuo-flat rounded-xl"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full lg:w-auto">
            <div className="relative flex-1 md:w-64 min-w-[200px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
              <Input
                placeholder="Buscar ofertas..."
                className="pl-10 h-11 text-[10px] font-black uppercase tracking-widest border-none bg-deep-void shadow-skeuo-pressed text-white/80 placeholder:text-white/10 focus-visible:ring-1 focus-visible:ring-kinetic-orange/50 rounded-xl w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-11 px-4 text-[10px] font-black uppercase tracking-widest bg-white/5 border-none rounded-xl shadow-skeuo-flat hover:bg-white/10 transition-all shrink-0">
                  <ArrowUpDown className="w-3.5 h-3.5 mr-2 text-kinetic-orange" />
                  <span className="hidden sm:inline">{SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Ordenar'}</span>
                  <span className="sm:hidden">Ord.</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-anthracite-surface border-none shadow-skeuo-elevated rounded-xl p-1 z-50">
                <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-white/20 px-3 py-2">Ordenação</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/5 mx-2" />
                <DropdownMenuRadioGroup value={sortBy} onValueChange={setSortBy}>
                  {SORT_OPTIONS.map(opt => (
                    <DropdownMenuRadioItem key={opt.value} value={opt.value} className="text-xs font-bold uppercase tracking-widest py-3 rounded-lg hover:bg-white/5">
                      {opt.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center rounded-2xl p-1.5 bg-deep-void shadow-skeuo-pressed h-11 shrink-0">
              <Button 
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                size="sm" 
                className={cn(
                  "h-8 w-8 p-0 rounded-lg transition-all",
                  viewMode === 'grid' ? "bg-white/10 text-kinetic-orange shadow-skeuo-flat" : "text-white/20 hover:text-white"
                )} 
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button 
                variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                size="sm" 
                className={cn(
                  "h-8 w-8 p-0 rounded-lg transition-all",
                  viewMode === 'list' ? "bg-white/10 text-kinetic-orange shadow-skeuo-flat" : "text-white/20 hover:text-white"
                )} 
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <Tabs value={offerType} onValueChange={setOfferType} className="w-full">
          <TabsList className="bg-transparent border-b border-white/5 w-full justify-start rounded-none h-auto p-0 gap-4 sm:gap-8 overflow-x-auto no-scrollbar">
            {OFFER_TABS.map(tab => (
              <TabsTrigger 
                key={tab.value} 
                value={tab.value}
                className="px-0 py-3 text-[10px] font-black uppercase tracking-widest rounded-none border-b-2 border-transparent data-[state=active]:border-kinetic-orange data-[state=active]:bg-transparent data-[state=active]:text-kinetic-orange transition-all whitespace-nowrap"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Filtros Avançados — Inline, ocultos por padrão (Base44 pattern) */}
      {showFilters && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
          <RadarFilters 
            filters={filters} 
            onFilterChange={setFilters} 
            onReset={handleResetFilters} 
          />
        </div>
      )}

      {/* Barra de Contexto Operacional — Base44 pattern */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <p className="text-xs text-white/40 font-bold uppercase tracking-widest">
            <span className="text-white/80 font-black font-headline">{products?.length || 0}</span> produtos
          </p>
          {selectedProducts.length > 0 && (
            <div className="flex items-center gap-3">
              <Badge className="bg-kinetic-orange/10 text-kinetic-orange border-none text-[10px] font-black uppercase tracking-widest px-3 py-1 shadow-skeuo-flat">
                <CheckSquare className="w-3 h-3 mr-1.5" />
                {selectedProducts.length} selecionados
              </Badge>
              <button 
                onClick={clearProducts} 
                className="text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-red-500 transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Limpar
              </button>
            </div>
          )}
        </div>

        {/* Info de seleção persistente — only show once */}
        {selectedProducts.length === 0 && (
          <div className="flex items-center gap-2 text-[10px] text-emerald-500/50 font-bold uppercase tracking-widest">
            <CheckSquare className="w-3 h-3" />
            Seleção persistente entre abas
          </div>
        )}
      </div>

      {/* Product Grid — Full width, restored to 4 cols */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-10 h-10 text-kinetic-orange animate-spin" />
          <p className="text-sm font-bold uppercase tracking-tight text-white/30">Sintonizando as melhores ofertas...</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold uppercase tracking-tight">Ocorreu um erro</h3>
            <p className="text-sm text-white/30">Não foi possível carregar as ofertas. Tente novamente em instantes.</p>
          </div>
          <Button variant="outline" onClick={() => window.location.reload()}>Recarregar Página</Button>
        </div>
      ) : products?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center text-white/30 border-2 border-dashed border-white/5 rounded-2xl">
          <ShoppingCart className="w-12 h-12 opacity-20" />
          <div>
            <h3 className="text-lg font-bold uppercase tracking-tight">Nenhuma oferta encontrada</h3>
            <p className="text-sm">Tente ajustar seus filtros ou mudar a categoria.</p>
          </div>
          <Button variant="link" onClick={handleResetFilters} className="text-kinetic-orange">Limpar todos os filtros</Button>
        </div>
      ) : (
        <div className={cn(
          "grid gap-4",
          viewMode === 'grid' 
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
            : "grid-cols-1"
        )}>
          {products?.map(product => (
            <ProductCard 
              key={product.id}
              product={product}
              isSelected={isSelected(product.id)}
              onSelect={toggleProduct}
              onToggleFavorite={(id, fav) => toggleFavoriteMutation.mutate({ id, isFavorite: fav })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
