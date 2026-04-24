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
  Package
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
import LayoutContainer from '@/components/layout/LayoutContainer';
import { SHOPEE_SORT_TYPE, SHOPEE_LIST_TYPE, SHOPEE_SORT_TYPE_LABELS, SHOPEE_LIST_TYPE_LABELS } from '@/lib/constants/shopee';

export default function RadarOfertasPage() {
  // --- STATE ---
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [marketplace, setMarketplace] = useState('all');
  const [offerType, setOfferType] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('score_desc');
  const [filters, setFilters] = useState<ProductFilter>({});
  const [showFilters, setShowFilters] = useState(false);

  // Garimpo Shopee State
  const [garimpSearch, setGarimpSearch] = useState('');
  const [isGarimping, setIsGarimping] = useState(false);
  const [garimpResults, setGarimpResults] = useState<Product[] | null>(null);
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
  const [shopeeLimit, setShopeeLimit] = useState('20'); // Quantidades (Ref: 3, 6, 9, 18, 36, 50)
  const [fallbackActivated, setFallbackActivated] = useState(false);
  const [similarResults, setSimilarResults] = useState<Product[] | null>(null);
  
  const queryClient = useQueryClient();

  // --- HANDLERS ---
  const handleGarimpShopee = useCallback(async (isLoadMore = false) => {
    if (!garimpSearch.trim() || isGarimping) return;
    
    setIsGarimping(true);

    // UX: Resetar estados ao buscar novos produtos
    if (!isLoadMore) {
      setSearch('');
      setGarimpResults(null); 
      setVisibleCount(15);
    }

    const nextPage = isLoadMore ? garimpPage + 1 : 1;
    
    // Log para validação no front
    console.log("[RADAR-FRONT]", { sortType: shopeeSort, listType: shopeeList });

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
        const countFound = data.products?.length || 0;
        const hasSimilar = data.similar_products?.length > 0;

        setFallbackActivated(!!data.filters_zeroed_results);
        setSimilarResults(data.similar_products || null);

        if (countFound > 0 || hasSimilar) {
          const resultsToSet = countFound > 0 ? data.products : data.similar_products;

          if (isLoadMore && garimpResults) {
            setGarimpResults([...garimpResults, ...resultsToSet]);
          } else {
            setGarimpResults(resultsToSet);
          }
          
          setHasGarimpedOnce(true);
          setGarimpPage(nextPage);

          if (countFound > 0) {
            toast.success(`${countFound} ofertas detectadas na Shopee.`, { 
              description: `${data.persisted} itens salvos no histórico operacional.`,
              duration: 5000 
            });
          } else {
            toast.info('Nenhum item bateu nos filtros. Mostrando sugestões semelhantes.');
          }
          
          queryClient.invalidateQueries({ queryKey: ['products'] });
        } else {
          toast.info('Nenhuma nova oferta encontrada na Shopee para este termo.');
        }
      } else {
        toast.error(data.error || 'Erro ao consultar a API de descoberta.');
      }
    } catch (err) {
      toast.error('Falha crítica de comunicação com o servidor de descoberta.');
    } finally {
      setIsGarimping(false);
    }
  }, [garimpSearch, isGarimping, garimpPage, sortBy, queryClient, minPrice, maxPrice, minCommission]);

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
  const [isBulkAuditing, setIsBulkAuditing] = useState(false);

  const handleBulkAudit = async () => {
    if (selectedProducts.length === 0 || isBulkAuditing) return;
    setIsBulkAuditing(true);
    const productIds = selectedProducts.map(p => p.id);
    try {
      const res = await fetch('/api/radar/audit/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds })
      });
      const data = await res.json();
      if (res.ok && data.status === 'SUCCESS') {
        toast.success(`Auditoria em lote concluída com sucesso!`);
        queryClient.invalidateQueries({ queryKey: ['products'] });
      }
    } catch (err) {
      toast.error('Erro na execução da auditoria em lote.');
    } finally {
      setIsBulkAuditing(false);
    }
  };

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
    if (offerType === 'opportunities') finalFilters.minDiscount = 20;
    else if (offerType === 'high_commission') { finalFilters.sortBy = 'commission_percent'; finalFilters.sortOrder = 'desc'; }
    else if (offerType === 'low_price') { finalFilters.sortBy = 'current_price'; finalFilters.sortOrder = 'asc'; }
    else if (offerType === 'coupons') finalFilters.has_coupon = true;
    else if (offerType === 'favorites') finalFilters.favorites_only = true;

    if (sortBy === 'score_desc') { finalFilters.sortBy = 'opportunity_score'; finalFilters.sortOrder = 'desc'; }
    else if (sortBy === 'commission_desc') { finalFilters.sortBy = 'commission_percent'; finalFilters.sortOrder = 'desc'; }
    else if (sortBy === 'commission_asc') { finalFilters.sortBy = 'commission_percent'; finalFilters.sortOrder = 'asc'; }
    else if (sortBy === 'price_asc') { finalFilters.sortBy = 'current_price'; finalFilters.sortOrder = 'asc'; }
    else if (sortBy === 'price_desc') { finalFilters.sortBy = 'current_price'; finalFilters.sortOrder = 'desc'; }
    return finalFilters;
  }, [filters, offerType, sortBy]);

  // --- DATA FETCHING ---
  const { data: rawProducts, isLoading, isError, refetch } = useProducts({
    ...combinedFilters,
    marketplace: marketplace === 'all' ? undefined : marketplace,
    search: search || undefined,
    status: (statusFilter === 'review' || statusFilter === 'dead') ? (statusFilter === 'review' ? 'review_needed' : 'dead') : undefined,
    exclude_dead: statusFilter === 'active',
  });

  // Grid com Dupla Origem: Prioriza garimpResults (efêmero) sobre rawProducts (banco)
  const products = useMemo(() => {
    if (garimpResults !== null) return garimpResults;
    if (!rawProducts) return [];
    return rawProducts as Product[];
  }, [garimpResults, rawProducts]);

  // Chunking Visual: Limita exibição inicial para performance e UX operacional
  const displayedProducts = useMemo(() => {
    return products.slice(0, visibleCount);
  }, [products, visibleCount]);

  const handleResetFilters = () => {
    setFilters({});
    setSearch('');
    setMarketplace('all');
    setOfferType('all');
    setSortBy('score_desc');
    setGarimpResults(null); // Limpa resultados do garimpo para voltar ao banco
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
                <KineticButton 
                  onClick={handleBulkAudit} 
                  disabled={isBulkAuditing} 
                  className="h-11 px-4 text-[10px] bg-white/5 text-white/60 shadow-skeuo-flat border-none"
                >
                  {isBulkAuditing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Auditar ({selectedProducts.length})
                </KineticButton>
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
                onKeyDown={(e) => e.key === 'Enter' && handleGarimpShopee(false)}
              />
            </div>
            
            <div className="flex items-center gap-3 w-full lg:w-auto">
              <Button 
                variant="ghost" 
                onClick={() => setShowGarimpFilters(!showGarimpFilters)}
                className={cn(
                  "h-14 px-6 rounded-2xl transition-all border-none font-black text-[10px] uppercase tracking-widest",
                  showGarimpFilters ? "bg-kinetic-orange/10 text-kinetic-orange shadow-skeuo-pressed" : "bg-white/5 text-white/40 hover:bg-white/10 shadow-skeuo-flat"
                )}
              >
                <SlidersHorizontal size={18} className="mr-2.5" />
                Filtros Discovery
              </Button>

              <KineticButton 
                onClick={() => handleGarimpShopee(false)} 
                disabled={isGarimping || !garimpSearch.trim()}
                className="h-14 px-10 rounded-2xl font-black text-[10px] uppercase tracking-widest min-w-[160px]"
              >
                {isGarimping ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                {isGarimping ? 'Processando' : 'DESCOBRIR'}
              </KineticButton>
            </div>
          </div>

          {/* Expandable Advanced Discovery Filters */}
          {showGarimpFilters && (
            <div className="mt-5 pt-5 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
               <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4">
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 ml-2">Quantidades</span>
                    <select 
                      value={shopeeLimit} 
                      onChange={(e) => setShopeeLimit(e.target.value)}
                      className="w-full h-12 bg-deep-void border-none shadow-skeuo-pressed text-[10px] font-bold rounded-xl text-white/80 px-3 outline-none appearance-none"
                    >
                      {[3, 6, 9, 18, 36, 50].map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 ml-2">Ordenar</span>
                    <select 
                      value={shopeeSort} 
                      onChange={(e) => setShopeeSort(Number(e.target.value))}
                      className="w-full h-12 bg-deep-void border-none shadow-skeuo-pressed text-[10px] font-bold rounded-xl text-white/80 px-3 outline-none appearance-none"
                    >
                      <option value={SHOPEE_SORT_TYPE.RELEVANCE}>{SHOPEE_SORT_TYPE_LABELS[SHOPEE_SORT_TYPE.RELEVANCE]}</option>
                      <option value={SHOPEE_SORT_TYPE.BEST_SELLERS}>{SHOPEE_SORT_TYPE_LABELS[SHOPEE_SORT_TYPE.BEST_SELLERS]}</option>
                      <option value={SHOPEE_SORT_TYPE.TOP_COMMISSION}>{SHOPEE_SORT_TYPE_LABELS[SHOPEE_SORT_TYPE.TOP_COMMISSION]}</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 ml-2">Tipo de Lista</span>
                    <select 
                      value={shopeeList} 
                      onChange={(e) => setShopeeList(e.target.value)}
                      className="w-full h-12 bg-deep-void border-none shadow-skeuo-pressed text-[10px] font-bold rounded-xl text-white/80 px-3 outline-none appearance-none"
                    >
                      <option value={SHOPEE_LIST_TYPE.DEFAULT}>{SHOPEE_LIST_TYPE_LABELS[SHOPEE_LIST_TYPE.DEFAULT]}</option>
                      <option value={SHOPEE_LIST_TYPE.PROMOTION}>{SHOPEE_LIST_TYPE_LABELS[SHOPEE_LIST_TYPE.PROMOTION]}</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 ml-2">Preço Mín</span>
                    <Input 
                      type="number" placeholder="0.00" value={minPrice} onChange={(e) => setMinPrice(e.target.value)}
                      className="h-12 bg-deep-void border-none shadow-skeuo-pressed text-xs font-bold rounded-xl text-white/80"
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 ml-2">Preço Máx</span>
                    <Input 
                      type="number" placeholder="Sem limite" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}
                      className="h-12 bg-deep-void border-none shadow-skeuo-pressed text-xs font-bold rounded-xl text-white/80"
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 ml-2">Comissão Min (R$)</span>
                    <Input 
                      type="number" placeholder="0.00" value={minCommission} onChange={(e) => setMinCommission(e.target.value)}
                      className="h-12 bg-deep-void border-none shadow-skeuo-pressed text-xs font-bold rounded-xl text-white/80"
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        setMinPrice(''); setMaxPrice(''); setMinCommission(''); 
                        setShopeeSort(SHOPEE_SORT_TYPE.RELEVANCE); setShopeeList(SHOPEE_LIST_TYPE.DEFAULT.toString()); setShopeeLimit('20');
                      }}
                      className="h-12 w-full bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-widest rounded-xl"
                    >
                      Resetar
                    </Button>
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* 3. Operational Control Bar — Clusterized Controls */}
        <div className="flex flex-col xl:flex-row gap-6 items-center justify-between">
           <div className="flex flex-wrap items-center gap-4">
              {/* Marketplace Selector */}
              <Tabs value={marketplace} onValueChange={setMarketplace}>
                <TabsList className="bg-deep-void shadow-skeuo-pressed p-1 h-12 rounded-2xl border-none border border-white/[0.01]">
                  {MARKETPLACE_TABS.map(tab => (
                    <TabsTrigger key={tab.value} value={tab.value} className="px-6 text-[10px] font-black uppercase tracking-widest transition-all data-[state=active]:bg-white/5 data-[state=active]:text-kinetic-orange data-[state=active]:shadow-skeuo-flat rounded-xl">
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {/* Status Selector */}
              <Tabs value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
                <TabsList className="bg-deep-void shadow-skeuo-pressed p-1 h-12 rounded-2xl border-none border border-white/[0.01]">
                  <TabsTrigger value="active" className="px-5 text-[10px] font-black uppercase tracking-widest data-[state=active]:text-emerald-500 rounded-xl">Ativos</TabsTrigger>
                  <TabsTrigger value="review" className="px-5 text-[10px] font-black uppercase tracking-widest data-[state=active]:text-yellow-500 rounded-xl">Revisar</TabsTrigger>
                  <TabsTrigger value="dead" className="px-5 text-[10px] font-black uppercase tracking-widest data-[state=active]:text-red-500 rounded-xl">Mortos</TabsTrigger>
                  <TabsTrigger value="all" className="px-5 text-[10px] font-black uppercase tracking-widest data-[state=active]:text-white rounded-xl">Todos</TabsTrigger>
                </TabsList>
              </Tabs>
           </div>

           <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
              {/* Internal Search */}
              <div className="relative flex-1 md:w-64">
                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-white/10" size={16} />
                <Input
                  placeholder="FILTRAR ITENS CARREGADOS (Filtro Local)..."
                  className="pl-11 h-12 bg-deep-void border-none shadow-skeuo-pressed rounded-xl text-[10px] font-black uppercase tracking-widest text-white/50 placeholder:text-white/5"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Sorting & Display */}
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-12 px-5 bg-white/5 rounded-xl shadow-skeuo-flat border-none font-black text-[10px] uppercase tracking-widest hover:text-kinetic-orange hover:bg-white/10 transition-all">
                      <ArrowUpDown size={16} className="mr-2.5 text-kinetic-orange" />
                      {SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Ordenar'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 bg-anthracite-surface border-none shadow-skeuo-elevated rounded-2xl p-1.5 z-50">
                    <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 p-3">Critério de Relevância</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/5 mx-2" />
                    <DropdownMenuRadioGroup value={sortBy} onValueChange={setSortBy}>
                      {SORT_OPTIONS.map(opt => (
                        <DropdownMenuRadioItem key={opt.value} value={opt.value} className="text-[10px] font-black uppercase tracking-widest py-3.5 px-4 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
                          {opt.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="bg-deep-void p-1 rounded-2xl shadow-skeuo-pressed flex items-center h-12 border border-white/[0.01]">
                    <Button variant="ghost" size="sm" onClick={() => setViewMode('grid')} className={cn("w-10 h-10 p-0 rounded-xl transition-all", viewMode === 'grid' ? "bg-white/10 text-kinetic-orange shadow-skeuo-flat" : "text-white/10 hover:text-white")}>
                      <LayoutGrid size={20} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setViewMode('list')} className={cn("w-10 h-10 p-0 rounded-xl transition-all", viewMode === 'list' ? "bg-white/10 text-kinetic-orange shadow-skeuo-flat" : "text-white/10 hover:text-white")}>
                      <List size={20} />
                    </Button>
                </div>
              </div>
           </div>
        </div>
      </div>

      {/* 4. Filter Chips Navigation — Offer Segmentations */}
      <Tabs value={offerType} onValueChange={setOfferType} className="mb-10">
        <TabsList className="bg-transparent border-b border-white/[0.03] w-full justify-start rounded-none h-auto p-0 gap-10 overflow-x-auto no-scrollbar">
          {OFFER_TABS.map(tab => (
            <TabsTrigger 
              key={tab.value} 
              value={tab.value}
              className="px-0 py-4 text-[10px] font-black uppercase tracking-widest rounded-none border-b-2 border-transparent data-[state=active]:border-kinetic-orange data-[state=active]:text-kinetic-orange transition-all whitespace-nowrap opacity-40 data-[state=active]:opacity-100"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

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
          {/* Fallback Warning Box */}
          {fallbackActivated && (
            <div className="mb-10 p-8 bg-white/5 rounded-[32px] border border-white/[0.05] shadow-skeuo-pressed animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-kinetic-orange/10 rounded-full flex items-center justify-center shadow-glow-orange-intense/20">
                    <AlertCircle size={24} className="text-kinetic-orange" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black uppercase tracking-widest text-white/90">Filtros muito restritivos</h4>
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest leading-relaxed">
                      Nenhum produto atende aos critérios de preço/comissão. <br/>
                      Mostrando sugestões semelhantes abaixo baseadas na sua busca.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      setMinPrice(''); setMaxPrice(''); setMinCommission('');
                      handleGarimpShopee(false);
                    }}
                    className="h-11 px-6 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest border-none"
                  >
                    Limpar Filtros
                  </Button>
                  <KineticButton 
                    onClick={() => handleGarimpShopee(true)}
                    className="h-11 px-8 rounded-xl text-[10px] font-black uppercase tracking-widest"
                  >
                    Buscar Mais
                  </KineticButton>
                </div>
              </div>
            </div>
          )}

          {/* Heading for Similar Products */}
          {fallbackActivated && (
             <div className="flex items-center gap-4 mb-8">
                <div className="h-px flex-1 bg-white/[0.03]" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 px-4">Sugestões Semelhantes</span>
                <div className="h-px flex-1 bg-white/[0.03]" />
             </div>
          )}
          
          {/* Radar Scanning Sweep Animation — High precision */}
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-kinetic-orange/60 to-transparent shadow-[0_0_25px_rgba(255,107,0,0.7)] z-10 animate-radar-scan pointer-events-none rounded-full" />
          
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
                  onViewDetails={() => toast.info('Detalhamento factual em processamento...')}
                />
              </div>
            ))}
          </div>

          {/* Pagination Controls — Chunking & Discovery Expansion */}
          <div className="mt-16 flex flex-col items-center gap-8">
            {/* 1. Chunking Local (Ver mais itens já carregados) */}
            {visibleCount < products.length && (
              <Button 
                variant="ghost"
                onClick={() => setVisibleCount(prev => prev + 15)}
                className="px-10 h-14 rounded-2xl bg-white/5 hover:bg-white/10 text-kinetic-orange font-black text-[11px] uppercase tracking-widest border border-white/[0.02]"
              >
                Ver +15 Itens Carregados ({products.length - visibleCount} restantes)
              </Button>
            )}

            {/* 2. Expansão de Varredura (Próxima página Shopee) */}
            {hasGarimpedOnce && (
               <KineticButton 
                 onClick={() => handleGarimpShopee(true)} 
                 disabled={isGarimping}
                 className="px-12 h-16 rounded-[24px] bg-white/5 hover:bg-white/10 text-white/40 hover:text-white border border-white/[0.02] shadow-skeuo-flat transition-all"
               >
                 {isGarimping ? <Loader2 size={20} className="animate-spin mr-3" /> : <RefreshCw size={20} className="mr-3" />}
                 {isGarimping ? 'Expandindo Varredura na Shopee...' : 'Varrer Próxima Página na Shopee'}
               </KineticButton>
            )}
          </div>
        </div>
      )}
    </LayoutContainer>
  );
}
