// src/app/(dashboard)/radar-ofertas/page.tsx
'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Product } from '@/types/product';
import { toast } from 'sonner';
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
  X,
  PackageSearch,
  RefreshCw,
  ShoppingBag,
  Filter,
  Package,
  Pin,
  ChevronLeft,
  ChevronRight,
  Trash2,
  PinOff,
  Eye 
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
import { ProductInspector } from '@/components/radar/ProductInspector';
import RadarFilters from '@/components/radar/RadarFilters';
import { MARKETPLACE_TABS, OFFER_TABS, SORT_OPTIONS } from '@/lib/constants';
import { ProductFilter } from '@/types/product';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import LayoutContainer from '@/components/layout/LayoutContainer';
import { SHOPEE_SORT_TYPE, SHOPEE_LIST_TYPE, SHOPEE_SORT_TYPE_LABELS, SHOPEE_LIST_TYPE_LABELS } from '@/lib/constants/shopee';

interface DiscoveryPage {
  pageNumber: number;
  products: Product[];
  rawCount: number;
  filteredCount: number;
  hasNextPage: boolean;
  status: 'ok' | 'few' | 'zero' | 'fallback';
  filters: {
    keyword: string;
    minPrice?: number;
    maxPrice?: number;
    sortType?: number;
  };
}

export default function RadarOfertasPage() {
  // --- STATE ---
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [marketplace, setMarketplace] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('score_desc');
  const [filters, setFilters] = useState<ProductFilter>({});
  const [showFilters, setShowFilters] = useState(false);

  // Garimpo Shopee State
  const [garimpSearch, setGarimpSearch] = useState('');
  const [isGarimping, setIsGarimping] = useState(false);
  const [activePageData, setActivePageData] = useState<DiscoveryPage | null>(null);
  const [selectedInspectorProduct, setSelectedInspectorProduct] = useState<Product | null>(null);
  const [pinnedProducts, setPinnedProducts] = useState<Product[]>([]);
  const [visibleCount, setVisibleCount] = useState(15);
  const [garimpPage, setGarimpPage] = useState(1);
  const [hasGarimpedOnce, setHasGarimpedOnce] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'active' | 'review' | 'dead' | 'all'>('active');
  const [showGarimpFilters, setShowGarimpFilters] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minCommission, setMinCommission] = useState('');
  const [shopeeSort, setShopeeSort] = useState<number>(SHOPEE_SORT_TYPE.RELEVANCE); 
  const [shopeeList, setShopeeList] = useState(SHOPEE_LIST_TYPE.DEFAULT.toString()); 
  const [shopeeLimit, setShopeeLimit] = useState('20');
  
  const queryClient = useQueryClient();

  // --- HANDLERS ---
  const handleGarimpShopee = useCallback(async (targetPage?: number) => {
    if (!garimpSearch.trim() || isGarimping) return;
    
    setIsGarimping(true);

    const nextPage = targetPage ?? 1;
    
    // UX: Resetar busca local ao iniciar nova descoberta global
    if (nextPage === 1 && !targetPage) {
      setSearch('');
      setVisibleCount(15);
    }

    try {
      const res = await fetch('/api/radar/fetch-shopee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          keyword: garimpSearch.trim(),
          page: nextPage,
          sortType: shopeeSort,
          listType: parseInt(shopeeList),
          limit: parseInt(shopeeLimit),
          minPrice: minPrice ? parseFloat(minPrice) : undefined,
          maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
          minCommission: minCommission ? parseFloat(minCommission) : undefined
        })
      });

      const data = await res.json();

      if (res.ok && data.status === 'SUCCESS') {
        const newPage: DiscoveryPage = {
          pageNumber: nextPage,
          products: data.products || [],
          rawCount: data.rawCount || 0,
          filteredCount: data.filteredCount || 0,
          hasNextPage: !!data.hasNextPage,
          status: data.pageStatus || 'ok',
          filters: {
            keyword: garimpSearch.trim(),
            minPrice: minPrice ? parseFloat(minPrice) : undefined,
            maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
            sortType: shopeeSort
          }
        };

        setActivePageData(newPage);
        setHasGarimpedOnce(true);
        setGarimpPage(nextPage);

        if (newPage.filteredCount > 0) {
          toast.success(`Página ${nextPage}: ${newPage.filteredCount} ofertas detectadas.`);
        } else if (newPage.status === 'fallback') {
          toast.info(`Página ${nextPage}: Nenhum item bateu nos filtros rígidos.`);
        } else {
          toast.info(`Página ${nextPage}: Nenhuma nova oferta encontrada.`);
        }
        
        queryClient.invalidateQueries({ queryKey: ['products'] });
      } else {
        toast.error(data.error || 'Erro ao consultar a API de descoberta.');
      }
    } catch (err) {
      toast.error('Falha crítica de comunicação com o servidor.');
    } finally {
      setIsGarimping(false);
    }
  }, [garimpSearch, isGarimping, queryClient, minPrice, maxPrice, minCommission, shopeeSort, shopeeList, shopeeLimit]);

  const togglePin = useCallback((product: Product) => {
    setPinnedProducts(prev => {
      const isPinned = prev.some(p => p.id === product.id);
      if (isPinned) {
        toast.info('Produto removido dos fixados.');
        return prev.filter(p => p.id !== product.id);
      } else {
        toast.success('Produto fixado na sessão.');
        return [...prev, { ...product }]; // Snapshot completo
      }
    });
  }, []);

  const handleAuditProduct = async (product: Product) => {
    try {
      const res = await fetch('/api/radar/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id })
      });
      const data = await res.json();
      if (res.ok && data.status === 'SUCCESS') {
        toast.success(`Sincronização concluída com sucesso!`, { icon: data.audit?.isEligible ? '✅' : '⚠️' });
        queryClient.invalidateQueries({ queryKey: ['products'] });
      } else {
        toast.error(data.error || 'Erro na auditoria individual.');
      }
    } catch (err) {
      toast.error('Falha de rede na auditoria individual.');
    }
  };

  // --- CONTEXT & HOOKS ---
  const { 
    toggleProduct, 
    isSelected, 
    selectedProducts, 
    clearProducts,
    count,
    hasIssues
  } = useSelectedProducts();
  const toggleFavoriteMutation = useToggleFavorite();

  const handleRemoveProblematic = () => {
    const problematicIds = selectedProducts
      .filter(p => p.status === 'dead' || p.status === 'audit_failed' || p.status === 'review_needed')
      .map(p => p.id);
    problematicIds.forEach(id => toggleProduct({ id } as Product));
    toast.success(`${problematicIds.length} itens removidos da seleção.`);
  };
  
  // --- MEMOIZED FILTERS ---
  const combinedFilters = useMemo(() => {
    let finalFilters = { ...filters };
    if (sortBy === 'score_desc') { finalFilters.sortBy = 'opportunity_score'; finalFilters.sortOrder = 'desc'; }
    else if (sortBy === 'commission_desc') { finalFilters.sortBy = 'commission_percent'; finalFilters.sortOrder = 'desc'; }
    else if (sortBy === 'commission_asc') { finalFilters.sortBy = 'commission_percent'; finalFilters.sortOrder = 'asc'; }
    else if (sortBy === 'price_asc') { finalFilters.sortBy = 'current_price'; finalFilters.sortOrder = 'asc'; }
    else if (sortBy === 'price_desc') { finalFilters.sortBy = 'current_price'; finalFilters.sortOrder = 'desc'; }
    return finalFilters;
  }, [filters, sortBy]);

  // --- DATA FETCHING ---
  const { data: rawProducts, isLoading, isError, refetch } = useProducts({
    ...combinedFilters,
    marketplace: marketplace === 'all' ? undefined : marketplace,
    search: search || undefined,
    status: (statusFilter === 'review' || statusFilter === 'dead') ? (statusFilter === 'review' ? 'review_needed' : 'dead') : undefined,
    exclude_dead: statusFilter === 'active',
  });

  const products = useMemo(() => {
    if (activePageData) return activePageData.products;
    if (!rawProducts) return [];
    return rawProducts as Product[];
  }, [activePageData, rawProducts]);

  // Chunking Visual: Limita exibição inicial para performance (apenas quando em modo histórico)
  const displayedProducts = useMemo(() => {
    if (activePageData) return activePageData.products;
    return products.slice(0, visibleCount);
  }, [products, visibleCount, activePageData]);

  const handleResetFilters = () => {
    setFilters({});
    setSearch('');
    setMarketplace('all');
    setSortBy('score_desc');
    setActivePageData(null); // Limpa resultados do garimpo para voltar ao banco
  };

  return (
    <LayoutContainer type="operational">
      {/* 1. Page Header — Design consistent with "Grupos" */}
      <PageHeader
        title="Radar de Ofertas"
        description="Monitoramento tático de oportunidades factuais em marketplaces integrados."
        icon={<PackageSearch size={24} className="text-kinetic-orange" />}
        actions={
          <div className="flex items-center gap-3">
             <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 bg-white/5 rounded-full shadow-skeuo-pressed border border-white/[0.02]">
              <Package size={14} className="text-kinetic-orange" />
              <span className="text-[10px] font-black text-white/90 uppercase tracking-widest leading-none">
                {products?.length || 0} Ativos
              </span>
            </div>

            {selectedProducts.length > 0 && (
              <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-500">
                <Link href="/envio-rapido">
                   <KineticButton className={cn("h-11 px-6 text-[10px]", hasIssues && "bg-yellow-500/20 text-yellow-500 shadow-glow-orange border-none")}>
                    <SendHorizonal size={16} /> Enviar Seleção
                   </KineticButton>
                </Link>
              </div>
            )}

            <Link href="/carrinho-ofertas">
              <Button variant="ghost" className="relative h-11 px-4 bg-white/5 rounded-xl shadow-skeuo-flat border-none group hover:bg-white/10 transition-all">
                <ShoppingCart size={18} className="text-white/40 group-hover:text-white" />
                {count > 0 && (
                  <span className={cn(
                    "absolute -top-1.5 -right-1.5 w-5 h-5 text-[10px] font-black rounded-full flex items-center justify-center border-2 border-deep-void shadow-glow-orange animate-pulse",
                    hasIssues ? "bg-yellow-500" : "bg-kinetic-orange text-white"
                  )}>
                    {count}
                  </span>
                )}
              </Button>
            </Link>
          </div>
        }
      />

      {/* 2. Tactical Discovery — Refined Skeuo Surface */}
      <div className="space-y-6 mb-10">
        <div className="bg-anthracite-surface p-5 rounded-[32px] shadow-skeuo-flat border border-white/[0.02] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-kinetic-orange/20 to-transparent opacity-30" />
          
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            {/* Search Input — Skeuo Cavity */}
            <div className="relative flex-1 group w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/10 group-focus-within:text-kinetic-orange transition-colors" size={20} />
              <Input
                placeholder="BUSCAR NOVAS OFERTAS NA SHOPEE (Discovery ex: Mouse Gamer...)"
                className="pl-12 h-14 bg-deep-void border-none shadow-skeuo-pressed rounded-2xl text-[13px] font-bold tracking-tight text-white/90 placeholder:text-white/10 focus-visible:ring-1 focus-visible:ring-kinetic-orange/20"
                value={garimpSearch}
                onChange={(e) => setGarimpSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGarimpShopee(1)}
              />
            </div>
            
            <div className="flex items-center gap-3 w-full lg:w-auto">
              <KineticButton 
                onClick={() => handleGarimpShopee(1)} 
                disabled={isGarimping || !garimpSearch.trim()}
                className="h-14 px-10 rounded-2xl font-black text-[10px] uppercase tracking-widest min-w-[160px]"
              >
                {isGarimping ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                {isGarimping ? 'Processando' : 'DESCOBRIR'}
              </KineticButton>
            </div>
          </div>

          {/* Shopee-style Horizontal Filter Bar */}
          <div className="mt-5 pt-5 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
             <div className="flex flex-wrap items-center gap-4">
                <span className="text-[11px] font-black uppercase tracking-widest text-white/20 mr-2">Classificar por</span>
                
                <div className="flex bg-deep-void p-1 rounded-xl shadow-skeuo-pressed">
                  {[
                    { id: SHOPEE_SORT_TYPE.RELEVANCE, label: 'Relevância' },
                    { id: SHOPEE_SORT_TYPE.BEST_SELLERS, label: 'Mais Vendidos' },
                    { id: SHOPEE_SORT_TYPE.TOP_COMMISSION, label: 'Comissão' }
                  ].map((opt) => (
                    <Button
                      key={opt.id}
                      variant="ghost"
                      onClick={() => setShopeeSort(opt.id)}
                      className={cn(
                        "h-10 px-6 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                        shopeeSort === opt.id 
                          ? "bg-kinetic-orange text-white shadow-glow-orange-intense" 
                          : "text-white/40 hover:text-white hover:bg-white/5"
                      )}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>

                <select 
                  value={shopeeList} 
                  onChange={(e) => setShopeeList(e.target.value)}
                  className="h-12 bg-deep-void border-none shadow-skeuo-pressed text-[10px] font-black uppercase tracking-widest rounded-xl text-white/80 px-4 outline-none appearance-none cursor-pointer min-w-[140px]"
                >
                  <option value={SHOPEE_LIST_TYPE.DEFAULT}>{SHOPEE_LIST_TYPE_LABELS[SHOPEE_LIST_TYPE.DEFAULT]}</option>
                  <option value={SHOPEE_LIST_TYPE.PROMOTION}>{SHOPEE_LIST_TYPE_LABELS[SHOPEE_LIST_TYPE.PROMOTION]}</option>
                </select>

                <div className="flex items-center gap-2 bg-deep-void p-1 rounded-xl shadow-skeuo-pressed">
                  <Input 
                    type="number" placeholder="Min $" value={minPrice} onChange={(e) => setMinPrice(e.target.value)}
                    className="h-10 w-24 bg-transparent border-none text-[10px] font-black text-center focus-visible:ring-0 text-white placeholder:text-white/10"
                  />
                  <div className="w-px h-4 bg-white/10" />
                  <Input 
                    type="number" placeholder="Max $" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}
                    className="h-10 w-24 bg-transparent border-none text-[10px] font-black text-center focus-visible:ring-0 text-white placeholder:text-white/10"
                  />
                </div>
             </div>

             {/* Top Quick Pagination */}
             {activePageData && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <span className="text-kinetic-orange font-black text-sm">{garimpPage}</span>
                    <span className="text-white/20 text-xs font-black">/ {activePageData.hasNextPage ? '...' : garimpPage}</span>
                  </div>
                  <div className="flex bg-deep-void p-1 rounded-xl shadow-skeuo-pressed">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={garimpPage <= 1 || isGarimping}
                      onClick={() => handleGarimpShopee(garimpPage - 1)}
                      className="h-9 w-9 p-0 text-white/40 disabled:opacity-10 hover:text-white"
                    >
                      <ChevronLeft size={18} />
                    </Button>
                    <div className="w-px h-4 bg-white/5 self-center" />
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!activePageData.hasNextPage || isGarimping}
                      onClick={() => handleGarimpShopee(garimpPage + 1)}
                      className="h-9 w-9 p-0 text-white/40 disabled:opacity-10 hover:text-white"
                    >
                      <ChevronRight size={18} />
                    </Button>
                  </div>
                </div>
             )}
          </div>
        </div>

      </div>


      {/* 5. Results Grid Area — Tactical States */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-[420px] bg-white/[0.02] rounded-[32px] shadow-skeuo-flat animate-pulse flex flex-col p-5 gap-5 border border-white/[0.02]">
               <div className="w-full h-48 bg-white/5 rounded-[24px]" />
               <div className="w-3/4 h-5 bg-white/5 rounded-full" />
               <div className="w-full h-24 bg-white/5 rounded-[20px]" />
               <div className="w-full h-11 mt-auto bg-white/5 rounded-xl" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="p-20 text-center bg-red-500/5 rounded-[48px] shadow-skeuo-pressed border border-red-500/10 max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8 shadow-skeuo-elevated">
            <AlertCircle size={40} className="text-red-500" />
          </div>
          <h3 className="text-2xl font-black uppercase tracking-[0.2em] text-white/90 font-headline italic">Instabilidade de Varredura</h3>
          <p className="text-white/30 mt-4 leading-relaxed font-bold max-w-md mx-auto uppercase text-[10px] tracking-widest">
            Não foi possível sincronizar a malha de dados operacionais do Radar. Verifique sua conexão com os marketplaces.
          </p>
          <KineticButton onClick={() => refetch()} className="mt-10 px-10 h-14 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500/20 border-none">
            <RefreshCw size={18} className="mr-3" /> Tentar Re-Sincronizar
          </KineticButton>
        </div>
      ) : products?.length === 0 ? (
        <div className="p-24 text-center bg-anthracite-surface/40 rounded-[56px] shadow-skeuo-pressed border border-white/[0.01] max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-500">
          <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8 shadow-skeuo-elevated">
            <ShoppingBag size={48} className="text-white/10" />
          </div>
          <h3 className="text-2xl font-black uppercase tracking-[0.2em] text-white/20 font-headline italic">Silêncio no Radar</h3>
          <p className="text-white/10 mt-4 leading-relaxed max-w-sm mx-auto font-bold uppercase text-[9px] tracking-[0.3em]">
            Nenhuma oportunidade factual detectada para os filtros de curadoria atuais.
          </p>
          <Button variant="link" onClick={handleResetFilters} className="text-kinetic-orange mt-8 uppercase font-black text-[11px] tracking-[0.2em] hover:opacity-70 transition-all no-underline">
            Resetar Parâmetros de Curadoria
          </Button>
        </div>
      ) : (
        <div className="relative pb-20">
          
          {/* SEÇÃO DE PRODUTOS FIXADOS (PINNED) */}
          {pinnedProducts.length > 0 && (
            <div className="mb-12 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
               <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-4 py-2 bg-kinetic-orange/10 rounded-full border border-kinetic-orange/20 shadow-glow-orange/10">
                    <Pin size={14} className="text-kinetic-orange" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-kinetic-orange">Produtos Fixados ({pinnedProducts.length})</span>
                  </div>
                  <div className="h-px flex-1 bg-white/[0.03]" />
                  <Button 
                    variant="ghost" 
                    onClick={() => setPinnedProducts([])}
                    className="text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-white/40"
                  >
                    Limpar Tudo
                  </Button>
               </div>

               <div className={cn(
                  "grid gap-8",
                  viewMode === 'grid' 
                    ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
                    : "grid-cols-1"
                )}>
                  {pinnedProducts.map(product => (
                    <ProductCard 
                      key={`pinned-${product.id}`}
                      product={product}
                      isSelected={isSelected(product.id)}
                      isPinned={true}
                      onSelect={toggleProduct}
                      onTogglePin={togglePin}
                      onToggleFavorite={(id, fav) => toggleFavoriteMutation.mutate({ id, isFavorite: fav })}
                      onAudit={handleAuditProduct}
                      onViewDetails={() => toast.info('Detalhamento factual em processamento...')}
                    />
                  ))}
               </div>
               <div className="h-px w-full bg-white/[0.03] mt-12" />
            </div>
          )}

          {activePageData ? (
            <div className="space-y-8 animate-in fade-in duration-700">

              {/* Main Grid — Active Page only */}
              <div className={cn(
                "grid gap-8 transition-all duration-500",
                viewMode === 'grid' 
                  ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
                  : "grid-cols-1"
              )}>
                {activePageData.products.map(product => (
                  <ProductCard 
                    key={product.id}
                    product={product}
                    isSelected={isSelected(product.id)}
                    isPinned={pinnedProducts.some(p => p.id === product.id)}
                    onSelect={toggleProduct}
                    onTogglePin={togglePin}
                    onToggleFavorite={(id, fav) => toggleFavoriteMutation.mutate({ id, isFavorite: fav })}
                    onAudit={handleAuditProduct}
                    onViewDetails={(p) => setSelectedInspectorProduct(p)}
                  />
                ))}
              </div>

              {activePageData.products.length === 0 && (
                <div className="py-20 text-center bg-white/[0.01] rounded-[32px] border border-dashed border-white/5">
                   <PackageSearch size={32} className="mx-auto mb-4 text-white/5" />
                   <h5 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30 mb-2">Página Vazia</h5>
                   <p className="text-[9px] font-bold uppercase tracking-widest text-white/10">Nenhum resultado aprovado pelo filtro rígido nesta página.</p>
                </div>
              )}

              {/* SEQUENTIAL PAGINATION CONTROLS */}
              <div className="mt-12 flex items-center justify-center gap-6">
                 <Button
                    variant="ghost"
                    disabled={garimpPage <= 1 || isGarimping}
                    onClick={() => handleGarimpShopee(garimpPage - 1)}
                    className="h-14 px-6 bg-white/5 hover:bg-white/10 rounded-2xl shadow-skeuo-flat border-none group transition-all"
                 >
                    <ChevronLeft size={20} className={cn("mr-2 transition-transform", !isGarimping && "group-hover:-translate-x-1")} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Anterior</span>
                 </Button>

                 <div className="flex flex-col items-center gap-1">
                    <span className="text-[8px] font-black uppercase tracking-[0.4em] text-white/10">Navegação Sequencial</span>
                    <div className="h-14 px-8 bg-deep-void shadow-skeuo-pressed rounded-2xl flex items-center justify-center min-w-[140px]">
                       <span className="text-xl font-black font-headline text-kinetic-orange tracking-widest">
                          {isGarimping ? <Loader2 size={20} className="animate-spin" /> : garimpPage}
                       </span>
                    </div>
                 </div>

                 <Button
                    variant="ghost"
                    disabled={!activePageData.hasNextPage || isGarimping}
                    onClick={() => handleGarimpShopee(garimpPage + 1)}
                    className="h-14 px-6 bg-white/5 hover:bg-white/10 rounded-2xl shadow-skeuo-flat border-none group transition-all"
                 >
                    <span className="text-[10px] font-black uppercase tracking-widest">Próxima</span>
                    <ChevronRight size={20} className={cn("ml-2 transition-transform", !isGarimping && "group-hover:translate-x-1")} />
                 </Button>
              </div>
            </div>
          ) : (
            <div className={cn(
              "grid gap-8 transition-all duration-700",
              viewMode === 'grid' 
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
                : "grid-cols-1"
            )}>
              {displayedProducts?.map(product => (
                <div key={product.id} className="animate-in fade-in zoom-in-95 duration-500">
                  <ProductCard 
                    product={product}
                    isSelected={isSelected(product.id)}
                    onSelect={toggleProduct}
                    onToggleFavorite={(id, fav) => toggleFavoriteMutation.mutate({ id, isFavorite: fav })}
                    onAudit={handleAuditProduct}
                    onViewDetails={(p) => setSelectedInspectorProduct(p)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Product Inspector Modal */}
          <ProductInspector 
            product={selectedInspectorProduct}
            isOpen={!!selectedInspectorProduct}
            onClose={() => setSelectedInspectorProduct(null)}
            onSelect={toggleProduct}
            isSelected={selectedInspectorProduct ? isSelected(selectedInspectorProduct.id) : false}
          />

          {/* Local Chunking (Only for History mode) */}
          {visibleCount < products.length && !activePageData && (
            <div className="mt-16 flex justify-center">
              <Button 
                variant="ghost"
                onClick={() => setVisibleCount(prev => prev + 15)}
                className="px-10 h-14 rounded-2xl bg-white/5 hover:bg-white/10 text-kinetic-orange font-black text-[11px] uppercase tracking-widest border border-white/[0.02]"
              >
                Ver +15 Itens Carregados ({products.length - visibleCount} restantes)
              </Button>
            </div>
          )}
        </div>
      )}
    </LayoutContainer>
  );
}
