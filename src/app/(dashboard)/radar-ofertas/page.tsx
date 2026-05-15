// src/app/(dashboard)/radar-ofertas/page.tsx
'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
  BadgePercent,
  Pin,
  ChevronLeft,
  ChevronRight,
  Trash2,
  PinOff,
  Eye,
  Store,
  Activity,
  Inbox
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { KeywordTagsInput } from '@/components/shared/KeywordTagsInput';
import { useAuth } from '@/contexts/AuthContext';
import { useUserMarketplaceConnections } from '@/hooks/use-marketplaces';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useShopeeOffers, ShopeeOffer } from '@/hooks/use-shopee-offers';
import { useShopeeCouponPages } from '@/hooks/use-shopee-coupon-pages';
import { useDiscoveredCoupons } from '@/hooks/use-discovered-coupons';
import { OffersGrid } from '@/components/radar-campanhas/OffersGrid';
import { CouponCard } from '@/components/radar-campanhas/CouponCard';
import { DiscoveredCouponCard } from '@/components/radar-ofertas/DiscoveredCouponCard';
import { DiscoveredPromoCard } from '@/components/radar-ofertas/DiscoveredPromoCard';
import { CampaignProductsDrawer } from '@/components/radar-campanhas/CampaignProductsDrawer';
import { useDiscoveredPromoPages } from '@/hooks/use-discovered-promo-pages';

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
  const { user } = useAuth();
  const { data: connections, isLoading: isLoadingConnections, isError: isErrorConnections } = useUserMarketplaceConnections(user?.id);
  const activeConnectionsCount = connections?.filter(c => c.is_active).length || 0;

  // --- STATE ---
  const [activeTab, setActiveTab] = useState<'products' | 'campaigns' | 'coupons'>('products');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [marketplace, setMarketplace] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('score_desc');
  const [filters, setFilters] = useState<ProductFilter>({});
  const [showFilters, setShowFilters] = useState(false);

  // Garimpo Shopee State
  const [garimpKeywords, setGarimpKeywords] = useState<string[]>([]);
  const [isGarimping, setIsGarimping] = useState(false);
  const [garimpProgressText, setGarimpProgressText] = useState('');
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
  const [minDiscount, setMinDiscount] = useState('0');
  const [shopeeSort, setShopeeSort] = useState<number>(SHOPEE_SORT_TYPE.RELEVANCE); 
  const shopeeList = SHOPEE_LIST_TYPE.DEFAULT.toString(); 
  const [shopeeLimit, setShopeeLimit] = useState('20');
  const [onlyOfficialShops, setOnlyOfficialShops] = useState(false);
  const [clientSort, setClientSort] = useState<'sales_desc' | 'discount_desc' | 'commission_desc' | 'none'>('none');

  // Hub de Cupons State
  const [couponSearchInput, setCouponSearchInput] = useState('');
  const [couponActiveKeyword, setCouponActiveKeyword] = useState<string | undefined>(undefined);
  const [couponFilterType, setCouponFilterType] = useState<'all' | 1 | 2>('all');
  const [selectedCouponOffer, setSelectedCouponOffer] = useState<ShopeeOffer | null>(null);
  const [couponSubTab, setCouponSubTab] = useState<'official' | 'detected_coupons' | 'detected_pages'>('official');
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);
  
  const queryClient = useQueryClient();
  const shopeeCache = React.useRef<Record<string, any>>({});

  // O shopeeList agora é fixo em DEFAULT via constante

  // --- HANDLERS ---
  const handleGarimpShopee = useCallback(async (targetPage?: number) => {
    if (garimpKeywords.length === 0 || isGarimping) return;
    
    setIsGarimping(true);
    setClientSort('none');

    const nextPage = targetPage ?? 1;
    
    if (nextPage === 1 && !targetPage) {
      setSearch('');
      setVisibleCount(15);
    }

    let allProducts: Product[] = [];
    let totalRawCount = 0;
    let totalFilteredCount = 0;
    let anyHasNextPage = false;
    let finalStatus: 'ok' | 'few' | 'zero' | 'fallback' = 'zero';

    try {
      for (let i = 0; i < garimpKeywords.length; i++) {
        const keyword = garimpKeywords[i];
        if (garimpKeywords.length > 1) {
          setGarimpProgressText(`Buscando '${keyword}'... (${i + 1} de ${garimpKeywords.length})`);
        } else {
          setGarimpProgressText('Buscando oportunidades...');
        }
        
        const cacheKey = `${keyword}_${nextPage}_${shopeeSort}_${shopeeList}_${shopeeLimit}_${minPrice}_${maxPrice}_${minCommission}_${onlyOfficialShops}_${minDiscount}`;
        
        let data;
        if (shopeeCache.current[cacheKey]) {
           data = shopeeCache.current[cacheKey];
        } else {
           const res = await fetch('/api/radar/fetch-shopee', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ 
               keyword: keyword.trim(),
               page: nextPage,
               sortType: shopeeSort,
               listType: parseInt(shopeeList),
               limit: parseInt(shopeeLimit),
               minPrice: minPrice ? parseFloat(minPrice) : undefined,
               maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
               minCommission: minCommission ? parseFloat(minCommission) : undefined,
               onlyOfficialShops
             })
           });
           data = await res.json();
           if (res.ok && data.status === 'SUCCESS') {
             // Cache result for 2 minutes (120000 ms)
             shopeeCache.current[cacheKey] = data;
             setTimeout(() => { delete shopeeCache.current[cacheKey]; }, 120000);
           }
        }

        if (data && data.status === 'SUCCESS') {
          let products = data.products || [];
          
          if (minDiscount && minDiscount !== '0') {
            const minD = parseFloat(minDiscount);
            products = products.filter((p: any) => (p.discount_percent || 0) >= minD);
          }

          // Deduplicate by ID
          const existingIds = new Set(allProducts.map(p => p.id));
          for (const p of products) {
            if (!existingIds.has(p.id)) {
              allProducts.push(p);
              existingIds.add(p.id);
            }
          }

          totalRawCount += data.rawCount || 0;
          totalFilteredCount += products.length;
          if (data.hasNextPage) anyHasNextPage = true;
          
          if (data.pageStatus === 'ok') finalStatus = 'ok';
          else if (data.pageStatus === 'few' && finalStatus !== 'ok') finalStatus = 'few';
          else if (data.pageStatus === 'fallback' && finalStatus === 'zero') finalStatus = 'fallback';
        }
      }

      const newPage: DiscoveryPage = {
        pageNumber: nextPage,
        products: allProducts,
        rawCount: totalRawCount,
        filteredCount: totalFilteredCount,
        hasNextPage: anyHasNextPage,
        status: finalStatus,
        filters: {
          keyword: garimpKeywords.join(', '),
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

    } catch (err) {
      toast.error('Falha crítica de comunicação com o servidor.');
    } finally {
      setIsGarimping(false);
      setGarimpProgressText('');
    }
  }, [garimpKeywords, isGarimping, queryClient, minPrice, maxPrice, minCommission, shopeeSort, shopeeList, shopeeLimit, onlyOfficialShops, minDiscount]);

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

  // --- CUPONS DATA ---
  const { 
    data: couponData, 
    isLoading: loadingCampaigns, 
    isError: campaignError, 
    error: campaignErrorObj,
    refetch: refetchCampaigns 
  } = useShopeeOffers(couponActiveKeyword);

  // --- CURATED CUPONS DATA ---
  const {
    data: curatedCoupons,
    isLoading: loadingCurated,
    isError: curatedError,
    refetch: refetchCurated
  } = useShopeeCouponPages();

  const {
    data: discoveredCouponsData,
    isLoading: loadingDiscovered,
    refetch: refetchDiscovered
  } = useDiscoveredCoupons({
    limit: 50,
    isVerified: showVerifiedOnly ? true : undefined
  });

  const {
    data: discoveredPromoData,
    isLoading: loadingPromoPages,
    refetch: refetchPromoPages
  } = useDiscoveredPromoPages({
    limit: 50
  });

  const filteredOffers = useMemo(() => {
    if (!couponData?.offers) return [];
    if (couponFilterType === 'all') return couponData.offers;
    return couponData.offers.filter(o => o.offerType === couponFilterType);
  }, [couponData, couponFilterType]);

  const handleCouponSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponActiveKeyword(couponSearchInput || undefined);
  };

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

  // --- CLIENT SIDE SORTING ---
  const sortedProducts = useMemo(() => {
    const list = activePageData ? [...activePageData.products] : [...displayedProducts];
    if (clientSort === 'sales_desc') return list.sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0));
    if (clientSort === 'discount_desc') return list.sort((a, b) => (b.discount_percent || 0) - (a.discount_percent || 0));
    if (clientSort === 'commission_desc') return list.sort((a, b) => (b.commission_percent || 0) - (a.commission_percent || 0));
    return list;
  }, [activePageData, displayedProducts, clientSort]);

  const handleResetFilters = () => {
    setFilters({});
    setSearch('');
    setMarketplace('all');
    setSortBy('score_desc');
    setActivePageData(null); // Limpa resultados do garimpo para voltar ao banco
  };

  return (
    <LayoutContainer type="operational">
      
      {/* Aviso Obrigatório de Marketplace */}
      {!isLoadingConnections && activeConnectionsCount === 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between p-6 bg-red-50/50 rounded-2xl border-2 border-red-100 border-dashed animate-in fade-in slide-in-from-top-4 mb-6 mt-2">
          <div className="flex gap-4 items-start sm:items-center">
            <div className="p-3 bg-red-100 rounded-full text-red-600 shrink-0">
              <AlertCircle size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-800">Conecte pelo menos um marketplace para o SYNCO funcionar corretamente.</h3>
              <p className="text-sm text-red-600 max-w-2xl mt-1">
                O SYNCO precisa das suas credenciais de afiliado para buscar produtos, gerar ofertas e montar campanhas automaticamente.
              </p>
            </div>
          </div>
          <div className="mt-4 sm:mt-0 shrink-0">
            <Link href="/marketplaces">
              <Button variant="default" className="bg-red-600 hover:bg-red-700 text-white gap-2 shadow-skeuo-flat border-none">
                <Store size={16} /> Conectar marketplace
              </Button>
            </Link>
          </div>
        </div>
      )}

      {isErrorConnections && (
        <div className="flex items-center gap-3 p-4 bg-red-50/50 rounded-xl border border-red-100/50 mb-6 mt-2">
          <AlertCircle size={20} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">
            Não foi possível carregar os marketplaces. Tente novamente ou contate o suporte.
          </p>
        </div>
      )}

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

      <div className="mb-8">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="bg-anthracite-surface/50 p-1.5 rounded-2xl border border-white/[0.02] shadow-skeuo-pressed h-14">
            <TabsTrigger 
              value="products" 
              className="rounded-xl px-8 h-11 data-[state=active]:bg-kinetic-orange data-[state=active]:text-white data-[state=active]:shadow-glow-orange font-black text-[10px] uppercase tracking-widest transition-all"
            >
              <Search size={14} className="mr-2" />
              Produtos
            </TabsTrigger>
            <TabsTrigger 
              value="coupons" 
              className="rounded-xl px-8 h-11 data-[state=active]:bg-kinetic-orange data-[state=active]:text-white data-[state=active]:shadow-glow-orange font-black text-[10px] uppercase tracking-widest transition-all"
            >
              <BadgePercent size={14} className="mr-2" />
              Cupons
            </TabsTrigger>
            <TabsTrigger 
              value="campaigns" 
              className="rounded-xl px-8 h-11 data-[state=active]:bg-kinetic-orange data-[state=active]:text-white data-[state=active]:shadow-glow-orange font-black text-[10px] uppercase tracking-widest transition-all"
            >
              <Store size={14} className="mr-2" />
              Campanhas
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === 'products' ? (
        <>
          {/* 2. Tactical Discovery — Refined Skeuo Surface */}
      <div className="space-y-6 mb-10">
        <div className="bg-anthracite-surface p-5 rounded-[32px] shadow-skeuo-flat border border-white/[0.02] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-kinetic-orange/20 to-transparent opacity-30" />
          
          <div className="flex flex-col lg:flex-row gap-4 items-start">
            {/* Search Input — Tag Based */}
            <div className="flex-1 w-full flex flex-col gap-2">
              <KeywordTagsInput
                value={garimpKeywords}
                onChange={setGarimpKeywords}
                maxKeywords={3}
                disabled={isGarimping}
                placeholder="Digite uma palavra e pressione Enter para adicionar"
                className="w-full bg-deep-void h-14"
              />
              <div className="flex items-center justify-between ml-2">
                <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">
                  Adicione até 3 palavras-chave para garimpar múltiplos nichos ao mesmo tempo
                </p>
                {isGarimping && garimpProgressText && (
                  <p className="text-[9px] font-black text-kinetic-orange uppercase tracking-widest animate-pulse">
                    {garimpProgressText}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex flex-col gap-2 w-full lg:w-[180px]">
              <KineticButton 
                onClick={() => handleGarimpShopee(1)} 
                disabled={isGarimping || garimpKeywords.length === 0}
                className="h-14 w-full rounded-2xl font-black text-[10px] uppercase tracking-widest"
              >
                {isGarimping ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                {isGarimping ? 'Processando' : 'DESCOBRIR'}
              </KineticButton>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-white/5 space-y-4">
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Parâmetros de Curadoria</span>
                {(minPrice || maxPrice || minCommission || minDiscount !== '0' || onlyOfficialShops) && (
                  <Button variant="ghost" onClick={() => { setMinPrice(''); setMaxPrice(''); setMinCommission(''); setMinDiscount('0'); setOnlyOfficialShops(false); }} className="h-6 text-[9px] font-bold uppercase text-kinetic-orange">
                    Limpar Filtros
                  </Button>
                )}
             </div>

             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {/* Ordenação */}
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <Label className="text-[9px] uppercase font-bold text-white/40">Ordenação</Label>
                  <Select value={shopeeSort.toString()} onValueChange={(v) => setShopeeSort(parseInt(v))}>
                    <SelectTrigger className="h-10 bg-deep-void border-none shadow-skeuo-pressed text-[10px] font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SHOPEE_SORT_TYPE.RELEVANCE.toString()}>{SHOPEE_SORT_TYPE_LABELS[SHOPEE_SORT_TYPE.RELEVANCE]}</SelectItem>
                      <SelectItem value={SHOPEE_SORT_TYPE.BEST_SELLERS.toString()}>{SHOPEE_SORT_TYPE_LABELS[SHOPEE_SORT_TYPE.BEST_SELLERS]}</SelectItem>
                      <SelectItem value={SHOPEE_SORT_TYPE.TOP_COMMISSION.toString()}>{SHOPEE_SORT_TYPE_LABELS[SHOPEE_SORT_TYPE.TOP_COMMISSION]}</SelectItem>
                      <SelectItem value={SHOPEE_SORT_TYPE.HIGHEST_DISCOUNT.toString()}>{SHOPEE_SORT_TYPE_LABELS[SHOPEE_SORT_TYPE.HIGHEST_DISCOUNT]}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>



                {/* Preços */}
                <div className="space-y-2 col-span-2 md:col-span-2">
                  <Label className="text-[9px] uppercase font-bold text-white/40">Faixa de Preço (R$)</Label>
                  <div className="flex items-center gap-2 bg-deep-void p-1 rounded-xl shadow-skeuo-pressed">
                    <Input type="number" placeholder="Min" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="h-8 bg-transparent border-none text-[10px] font-bold text-center w-full" />
                    <div className="w-px h-4 bg-white/10" />
                    <Input type="number" placeholder="Max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="h-8 bg-transparent border-none text-[10px] font-bold text-center w-full" />
                  </div>
                </div>

                {/* Comissão Mínima */}
                <div className="space-y-2 col-span-1 md:col-span-1">
                  <Label className="text-[9px] uppercase font-bold text-white/40">Comis. (R$)</Label>
                  <Input type="number" placeholder="Min" value={minCommission} onChange={(e) => setMinCommission(e.target.value)} className="h-10 bg-deep-void border-none shadow-skeuo-pressed text-[10px] font-bold" />
                </div>

                {/* Desconto Mínimo */}
                <div className="space-y-2 col-span-1 md:col-span-1">
                  <Label className="text-[9px] uppercase font-bold text-white/40">Desconto</Label>
                  <Select value={minDiscount} onValueChange={setMinDiscount}>
                    <SelectTrigger className="h-10 bg-deep-void border-none shadow-skeuo-pressed text-[10px] font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Qualquer</SelectItem>
                      <SelectItem value="10">10%+</SelectItem>
                      <SelectItem value="20">20%+</SelectItem>
                      <SelectItem value="30">30%+</SelectItem>
                      <SelectItem value="50">50%+</SelectItem>
                      <SelectItem value="70">70%+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
             </div>

             {/* Toggles e Paginação Topo */}
             <div className="flex flex-wrap items-center justify-between gap-6 pt-2">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2 group">
                    <Switch id="official-shops" checked={onlyOfficialShops} onCheckedChange={setOnlyOfficialShops} className="data-[state=checked]:bg-kinetic-orange scale-75" />
                    <Label htmlFor="official-shops" className="text-[9px] font-black uppercase tracking-widest text-white/40 group-hover:text-white/70 cursor-pointer">Lojas Oficiais</Label>
                  </div>
                </div>

                {/* Top Quick Pagination */}
                {activePageData && (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 min-w-[30px] justify-center">
                      {isGarimping ? (
                        <Loader2 size={16} className="animate-spin text-kinetic-orange" />
                      ) : (
                        <>
                          <span className="text-kinetic-orange font-black text-sm">{garimpPage}</span>
                          <span className="text-white/20 text-xs font-black">/ {activePageData.hasNextPage ? '...' : garimpPage}</span>
                        </>
                      )}
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

          {(activePageData || displayedProducts.length > 0) && (
            <div className="flex items-center gap-3 mb-8 animate-in fade-in slide-in-from-left-4 duration-700">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Re-ordenar:</span>
              <div className="flex bg-deep-void p-1 rounded-xl shadow-skeuo-pressed">
                {[
                  { id: 'none', label: 'Padrão' },
                  { id: 'sales_desc', label: 'Mais Vendidos' },
                  { id: 'discount_desc', label: 'Maior Desconto' },
                  { id: 'commission_desc', label: 'Maior Comissão' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setClientSort(opt.id as any)}
                    className={cn(
                      "h-8 px-4 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all",
                      clientSort === opt.id
                        ? "bg-kinetic-orange text-white shadow-glow-orange-intense"
                        : "text-white/30 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
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
                {sortedProducts.map(product => (
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
                   <p className="text-[9px] font-bold uppercase tracking-widest text-white/10">
                     Nenhum produto encontrado para &quot;{garimpKeywords.join(', ')}&quot;. Tente uma palavra diferente ou remova alguns filtros rígidos.
                   </p>
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
                          {isGarimping ? (
                            <div className="flex items-center gap-2">
                              <Loader2 size={16} className="animate-spin" />
                              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Processando</span>
                            </div>
                          ) : garimpPage}
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
              {sortedProducts?.map(product => (
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
        </>
      ) : activeTab === 'coupons' ? (
        /* Aba de Cupons (Oficiais + Detectados) */
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">
           
           {/* Seletor de Sub-Aba Estilo Tactical */}
           <div className="flex bg-anthracite-surface/30 p-1.5 rounded-[20px] border border-white/[0.02] shadow-skeuo-pressed w-fit mx-auto mb-2">
              <button
                onClick={() => setCouponSubTab('official')}
                className={cn(
                  "px-8 h-10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                  couponSubTab === 'official' 
                    ? "bg-kinetic-orange text-white shadow-glow-orange" 
                    : "text-white/30 hover:text-white/60"
                )}
              >
                Cupons Oficiais
              </button>
              <button
                onClick={() => setCouponSubTab('detected_coupons')}
                className={cn(
                  "px-8 h-10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                  couponSubTab === 'detected_coupons' 
                    ? "bg-kinetic-orange text-white shadow-glow-orange" 
                    : "text-white/30 hover:text-white/60"
                )}
              >
                <Activity size={12} className={cn(couponSubTab === 'detected_coupons' ? "animate-pulse" : "")} />
                Cupons Capturados
              </button>
              <button
                onClick={() => setCouponSubTab('detected_pages')}
                className={cn(
                  "px-8 h-10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                  couponSubTab === 'detected_pages' 
                    ? "bg-kinetic-orange text-white shadow-glow-orange" 
                    : "text-white/30 hover:text-white/60"
                )}
              >
                <Zap size={12} className={cn(couponSubTab === 'detected_pages' ? "animate-pulse" : "")} />
                Páginas de Ofertas
              </button>
           </div>

           {couponSubTab === 'official' ? (
             <div className="bg-anthracite-surface p-8 rounded-[40px] shadow-skeuo-flat border border-white/[0.02] relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-kinetic-orange/20 to-transparent opacity-30" />
               <div className="flex items-center gap-4 mb-8">
                 <div className="w-12 h-12 bg-kinetic-orange/10 rounded-2xl flex items-center justify-center shadow-skeuo-elevated">
                   <BadgePercent size={24} className="text-kinetic-orange" />
                 </div>
                 <div>
                   <h3 className="text-xl font-black uppercase tracking-widest text-white/90 italic font-headline">Central de Resgate</h3>
                   <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Páginas de benefícios e campanhas fixas da Shopee</p>
                 </div>
               </div>

               {loadingCurated ? (
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                   {[1, 2, 3, 4].map(i => (
                     <div key={i} className="h-64 bg-white/5 rounded-3xl animate-pulse shadow-skeuo-pressed" />
                   ))}
                 </div>
               ) : curatedCoupons && curatedCoupons.length > 0 ? (
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                   {curatedCoupons.map((page) => (
                     <CouponCard 
                       key={page.id}
                       hideCommission={true}
                       showImage={false}
                       offer={{
                         offerName: page.name,
                         offerLink: page.short_link,
                         imageUrl: page.image_url || '',
                         commissionPercent: 0,
                         commissionRate: '0',
                         periodEndFormatted: 'Disponível',
                         offerType: 1,
                         periodStartTime: 0,
                         periodEndTime: 0,
                         originalLink: page.original_url,
                         expiresAt: page.expires_at
                       }} 
                     />
                   ))}
                 </div>
               ) : (
                 <div className="p-20 text-center bg-deep-void/40 rounded-[32px] border border-white/5 shadow-skeuo-pressed">
                   <p className="text-[11px] font-black uppercase tracking-widest text-white/20">Nenhum cupom oficial disponível no momento.</p>
                 </div>
               )}
             </div>
           ) : couponSubTab === 'detected_coupons' ? (
             <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                <div className="bg-anthracite-surface p-8 rounded-[40px] shadow-skeuo-flat border border-white/[0.02] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-kinetic-orange/20 to-transparent opacity-30" />
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-kinetic-orange/10 rounded-2xl flex items-center justify-center shadow-skeuo-elevated">
                        <Activity size={24} className="text-kinetic-orange" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black uppercase tracking-widest text-white/90 italic font-headline">Monitoramento Radar</h3>
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Cupons detectados automaticamente em grupos e webhooks</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 mr-4 bg-deep-void/40 p-2 rounded-xl border border-white/5">
                        <Switch 
                          id="verified-only" 
                          checked={showVerifiedOnly} 
                          onCheckedChange={setShowVerifiedOnly} 
                          className="data-[state=checked]:bg-kinetic-orange scale-75"
                        />
                        <Label htmlFor="verified-only" className="text-[9px] font-black uppercase tracking-widest text-white/40 cursor-pointer">Apenas Verificados</Label>
                      </div>

                      <Button 
                        onClick={() => refetchDiscovered()}
                        variant="ghost" 
                        className="h-12 px-6 rounded-xl bg-white/5 border border-white/[0.02] shadow-skeuo-flat hover:bg-white/10 text-kinetic-orange font-black text-[9px] uppercase tracking-widest gap-2"
                        disabled={loadingDiscovered}
                      >
                        <RefreshCw size={14} className={cn(loadingDiscovered && "animate-spin")} />
                        Sincronizar Radar
                      </Button>
                    </div>
                  </div>

                  {loadingDiscovered ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className="h-64 bg-white/5 rounded-3xl animate-pulse shadow-skeuo-pressed" />
                      ))}
                    </div>
                  ) : discoveredCouponsData?.data && discoveredCouponsData.data.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {discoveredCouponsData.data.map((coupon) => (
                        <DiscoveredCouponCard 
                          key={coupon.id}
                          coupon={coupon}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="p-24 text-center bg-deep-void/40 rounded-[48px] border border-dashed border-white/5 shadow-skeuo-pressed">
                      <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Inbox size={32} className="text-white/10" />
                      </div>
                      <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30 mb-2">Radar em Silêncio</h4>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-white/10 max-w-sm mx-auto leading-relaxed">
                        Quando o Radar encontrar cupons da Shopee, eles aparecerão aqui para revisão manual e cópia segura.
                      </p>
                    </div>
                  )}
                </div>
             </div>
            ) : (
              <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
                 <div className="bg-anthracite-surface p-8 rounded-[40px] shadow-skeuo-flat border border-white/[0.02] relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-kinetic-orange/20 to-transparent opacity-30" />
                   
                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                     <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-kinetic-orange/10 rounded-2xl flex items-center justify-center shadow-skeuo-elevated">
                         <Zap size={24} className="text-kinetic-orange" />
                       </div>
                       <div>
                         <h3 className="text-xl font-black uppercase tracking-widest text-white/90 italic font-headline">Páginas de Ofertas</h3>
                         <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Páginas promocionais e eventos Shopee capturados</p>
                       </div>
                     </div>

                     <Button 
                       onClick={() => refetchPromoPages()}
                       variant="ghost" 
                       className="h-12 px-6 rounded-xl bg-white/5 border border-white/[0.02] shadow-skeuo-flat hover:bg-white/10 text-kinetic-orange font-black text-[9px] uppercase tracking-widest gap-2"
                       disabled={loadingPromoPages}
                     >
                       <RefreshCw size={14} className={cn(loadingPromoPages && "animate-spin")} />
                       Sincronizar Radar
                     </Button>
                   </div>

                   {loadingPromoPages ? (
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                       {[1, 2, 3, 4].map(i => (
                         <div key={i} className="h-64 bg-white/5 rounded-3xl animate-pulse shadow-skeuo-pressed" />
                       ))}
                     </div>
                   ) : discoveredPromoData?.data && discoveredPromoData.data.length > 0 ? (
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                       {discoveredPromoData.data.map((page) => (
                         <DiscoveredPromoCard 
                           key={page.id}
                           page={page}
                         />
                       ))}
                     </div>
                   ) : (
                     <div className="p-24 text-center bg-deep-void/40 rounded-[48px] border border-dashed border-white/5 shadow-skeuo-pressed">
                       <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                         <Inbox size={32} className="text-white/10" />
                       </div>
                       <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30 mb-2">Sem Páginas Capturadas</h4>
                       <p className="text-[9px] font-bold uppercase tracking-widest text-white/10 max-w-sm mx-auto leading-relaxed">
                         Páginas como /super-ofertas capturadas no Radar aparecerão aqui.
                       </p>
                     </div>
                   )}
                 </div>
              </div>
            )}
        </div>
      ) : (
        /* Aba de Campanhas (useShopeeOffers) */
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">
           {/* Filtros de Campanhas */}
           <div className="bg-anthracite-surface p-6 rounded-[32px] shadow-skeuo-flat border border-white/[0.02] relative overflow-hidden">
             <div className="flex flex-col md:flex-row items-center gap-6">
               <form onSubmit={handleCouponSearch} className="flex-1 w-full relative group">
                 <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                   <Search size={18} className="text-white/20 group-focus-within:text-kinetic-orange transition-colors" />
                 </div>
                 <Input
                   placeholder="Pesquisar em campanhas ativas..."
                   className="h-14 pl-12 pr-6 bg-deep-void shadow-skeuo-pressed border-none rounded-2xl text-[13px] font-bold text-white placeholder:text-white/10 focus-visible:ring-1 focus-visible:ring-kinetic-orange/30"
                   value={couponSearchInput}
                   onChange={(e) => setCouponSearchInput(e.target.value)}
                 />
                 <div className="absolute inset-y-0 right-2 flex items-center">
                   <KineticButton type="submit" className="h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest">
                     Buscar
                   </KineticButton>
                 </div>
               </form>

               <div className="flex items-center gap-4 w-full md:w-auto shrink-0">
                 <div className="flex-1 md:w-48">
                   <Select value={String(couponFilterType)} onValueChange={(v) => setCouponFilterType(v === 'all' ? 'all' : Number(v) as any)}>
                     <SelectTrigger className="h-14 bg-deep-void border-none shadow-skeuo-pressed rounded-2xl text-[11px] font-black uppercase tracking-widest text-white/40 focus:ring-1 focus:ring-kinetic-orange/30">
                       <div className="flex items-center gap-2">
                         <Filter size={14} className="text-kinetic-orange" />
                         <SelectValue placeholder="Filtrar Tipo" />
                       </div>
                     </SelectTrigger>
                     <SelectContent className="bg-deep-void border-white/5 rounded-2xl shadow-skeuo-elevated">
                       <SelectItem value="all" className="text-[10px] font-black uppercase tracking-widest py-3">Todos os Tipos</SelectItem>
                       <SelectItem value="1" className="text-[10px] font-black uppercase tracking-widest py-3">Coleções</SelectItem>
                       <SelectItem value="2" className="text-[10px] font-black uppercase tracking-widest py-3">Categorias</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>

                 <Button 
                   onClick={() => refetchCampaigns()}
                   variant="ghost" 
                   className="h-14 w-14 rounded-2xl bg-white/5 border border-white/[0.02] shadow-skeuo-flat hover:bg-white/10 text-kinetic-orange transition-all shrink-0"
                   disabled={loadingCampaigns}
                 >
                   <RefreshCw size={20} className={cn(loadingCampaigns && "animate-spin")} />
                 </Button>
               </div>
             </div>
           </div>

           <OffersGrid 
             offers={filteredOffers}
             isLoading={loadingCampaigns}
             isError={campaignError}
             error={campaignErrorObj}
             onRetry={() => refetchCampaigns()}
             onOfferClick={(offer) => setSelectedCouponOffer(offer)}
           />

           <CampaignProductsDrawer 
             offer={selectedCouponOffer} 
             onClose={() => setSelectedCouponOffer(null)} 
           />
        </div>
      )}
    </LayoutContainer>
  );
}
