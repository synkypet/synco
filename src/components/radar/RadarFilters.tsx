import React from 'react';
import { TactileCard } from '@/components/ui/TactileCard';
import { KineticButton } from '@/components/ui/KineticButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Filter, X, Save, ChevronDown, ChevronUp, Search, Sparkles } from 'lucide-react';
import { CATEGORY_LABELS, SAVED_FILTERS } from '@/lib/constants';
import { toast } from 'sonner';
import { ProductFilter } from '@/types/product';
import { cn } from '@/lib/utils';

interface RadarFiltersProps {
  filters: ProductFilter;
  onFilterChange: (filters: ProductFilter) => void;
  onReset: () => void;
}

const RadarFilters: React.FC<RadarFiltersProps> = ({ filters, onFilterChange, onReset }) => {
  const [expanded, setExpanded] = React.useState(false);

  const updateFilter = (key: keyof ProductFilter, value: any) => {
    onFilterChange({ ...filters, [key]: value });
  };

  return (
    <TactileCard className="p-5 border-none mb-6 relative overflow-hidden group">
      {/* Decorative pulse glow - fixed with pointer-events-none to prevent blocking interaction */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-kinetic-orange/5 blur-3xl rounded-full pointer-events-none" />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shadow-skeuo-flat">
            <Filter className="w-4 h-4 text-kinetic-orange" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-sm uppercase tracking-widest font-headline text-white/90">Filtros Avançados</span>
            <span className="text-[10px] font-bold text-white/20 uppercase tracking-tighter">Parâmetros de Sincronização</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-9 px-3 text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 text-white/30 hover:text-red-500 transition-all rounded-xl" 
            onClick={onReset}
          >
            <X className="w-3.5 h-3.5 mr-2" /> Limpar
          </Button>
          <KineticButton 
            className="h-9 px-4 text-[10px] font-black uppercase tracking-widest" 
            onClick={() => toast.success('Filtro salvo!')}
          >
            <Save className="w-3.5 h-3.5 mr-2" /> Salvar
          </KineticButton>
          <div className="w-px h-6 bg-white/5 mx-1" />
          <Button 
            variant="ghost" 
            size="sm" 
            className={cn(
                "h-9 w-9 p-0 rounded-xl transition-all relative z-10",
                expanded ? "bg-white/10 text-white" : "text-white/20"
            )} 
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Saved Filters - Chips with skeuo feedback */}
      <div className="flex gap-2 flex-wrap mb-6">
        <div className="flex items-center self-center mr-2 text-[9px] font-black uppercase text-white/20 tracking-widest">
           <Sparkles className="w-3 h-3 mr-1.5" /> Quick Sets:
        </div>
        {SAVED_FILTERS.map((sf) => (
          <button
            key={sf.name}
            className="group relative px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 bg-deep-void shadow-skeuo-pressed border-none text-white/30 hover:text-kinetic-orange active:scale-95"
            onClick={() => { 
                onFilterChange({ ...filters, ...sf.rules }); 
                toast.success(`Filtro "${sf.name}" aplicado`); 
            }}
          >
            {sf.name}
          </button>
        ))}
      </div>

      {/* Basic filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-white/30 tracking-widest ml-1">Categoria</Label>
          <Select value={filters.category || 'all'} onValueChange={(v) => updateFilter('category', v === 'all' ? undefined : v)}>
            <SelectTrigger className="h-11 bg-deep-void shadow-skeuo-pressed border-none text-xs font-bold text-white/70 uppercase px-4 rounded-xl focus:ring-1 focus:ring-kinetic-orange/50 transition-all">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent className="bg-anthracite-surface border-none shadow-skeuo-elevated rounded-xl">
              <SelectItem value="all" className="text-xs font-bold uppercase tracking-widest py-3">Todas as Categorias</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs font-bold uppercase tracking-widest py-3">{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-white/30 tracking-widest ml-1">Preço Máximo</Label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] text-white/20 font-black">R$</span>
            <Input 
                type="number" 
                placeholder="0.00" 
                className="h-11 bg-deep-void shadow-skeuo-pressed border-none text-xs pl-10 font-bold text-white/80 placeholder:text-white/10 rounded-xl focus-visible:ring-1 focus-visible:ring-kinetic-orange/50 transition-all" 
                value={filters.maxPrice || ''} 
                onChange={e => updateFilter('maxPrice', e.target.value ? Number(e.target.value) : undefined)} 
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-white/30 tracking-widest ml-1">Comissão Mín (%)</Label>
          <Input 
            type="number" 
            placeholder="0%" 
            className="h-11 bg-deep-void shadow-skeuo-pressed border-none text-xs px-4 font-bold text-white/80 placeholder:text-white/10 rounded-xl focus-visible:ring-1 focus-visible:ring-kinetic-orange/50 transition-all" 
            value={filters.minCommission || ''} 
            onChange={e => updateFilter('minCommission', e.target.value ? Number(e.target.value) : undefined)} 
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase text-white/30 tracking-widest ml-1">Score Mínimo</Label>
          <Input 
            type="number" 
            placeholder="0-100" 
            className="h-11 bg-deep-void shadow-skeuo-pressed border-none text-xs px-4 font-bold text-white/80 placeholder:text-white/10 rounded-xl focus-visible:ring-1 focus-visible:ring-kinetic-orange/50 transition-all" 
            value={filters.minScore || ''} 
            onChange={e => updateFilter('minScore', e.target.value ? Number(e.target.value) : undefined)} 
          />
        </div>
      </div>

      {/* Expanded filters */}
      {expanded && (
        <div className="mt-8 pt-8 border-t border-white/5 space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-white/30 tracking-widest ml-1">Preço Mínimo</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] text-white/20 font-black">R$</span>
                <Input 
                    type="number" 
                    placeholder="0.00" 
                    className="h-11 bg-deep-void shadow-skeuo-pressed border-none text-xs pl-10 font-bold text-white/80 placeholder:text-white/10 rounded-xl focus-visible:ring-1 focus-visible:ring-kinetic-orange/50 transition-all" 
                    value={filters.minPrice || ''} 
                    onChange={e => updateFilter('minPrice', e.target.value ? Number(e.target.value) : undefined)} 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-white/30 tracking-widest ml-1">Desconto Mín (%)</Label>
              <Input 
                type="number" 
                placeholder="0%" 
                className="h-11 bg-deep-void shadow-skeuo-pressed border-none text-xs px-4 font-bold text-white/80 placeholder:text-white/10 rounded-xl focus-visible:ring-1 focus-visible:ring-kinetic-orange/50 transition-all" 
                value={filters.minDiscount || ''} 
                onChange={e => updateFilter('minDiscount', e.target.value ? Number(e.target.value) : undefined)} 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-white/30 tracking-widest ml-1">Pesquisa Direta</Label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                <Input 
                  placeholder="Nome do produto..." 
                  className="h-11 bg-deep-void shadow-skeuo-pressed border-none text-xs pl-10 font-bold text-white/80 placeholder:text-white/10 rounded-xl focus-visible:ring-1 focus-visible:ring-kinetic-orange/50 transition-all" 
                  value={filters.search || ''} 
                  onChange={e => updateFilter('search', e.target.value)} 
                />
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-x-8 gap-y-4 bg-deep-void/30 p-5 rounded-2xl shadow-skeuo-pressed">
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => updateFilter('has_coupon' as any, !(filters as any).has_coupon)}>
              <div className="relative">
                <Switch 
                  id="coupon" 
                  checked={!!(filters as any).has_coupon} 
                  onCheckedChange={(v) => updateFilter('has_coupon' as any, v)} 
                  className="data-[state=checked]:bg-kinetic-orange"
                />
              </div>
              <Label htmlFor="coupon" className="text-[10px] font-black uppercase tracking-widest cursor-pointer text-white/40 group-hover:text-white/80 transition-colors">Com cupom</Label>
            </div>

            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => updateFilter('free_shipping' as any, !(filters as any).free_shipping)}>
              <Switch 
                id="shipping" 
                checked={!!(filters as any).free_shipping} 
                onCheckedChange={(v) => updateFilter('free_shipping' as any, v)} 
                className="data-[state=checked]:bg-kinetic-orange"
              />
              <Label htmlFor="shipping" className="text-[10px] font-black uppercase tracking-widest cursor-pointer text-white/40 group-hover:text-white/80 transition-colors">Frete grátis</Label>
            </div>

            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => updateFilter('official_store' as any, !(filters as any).official_store)}>
              <Switch 
                id="official" 
                checked={!!(filters as any).official_store} 
                onCheckedChange={(v) => updateFilter('official_store' as any, v)} 
                className="data-[state=checked]:bg-kinetic-orange"
              />
              <Label htmlFor="official" className="text-[10px] font-black uppercase tracking-widest cursor-pointer text-white/40 group-hover:text-white/80 transition-colors">Loja oficial</Label>
            </div>

            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => updateFilter('favorites_only' as any, !(filters as any).favorites_only)}>
              <Switch 
                id="favorites" 
                checked={!!(filters as any).favorites_only} 
                onCheckedChange={(v) => updateFilter('favorites_only' as any, v)} 
                className="data-[state=checked]:bg-kinetic-orange"
              />
              <Label htmlFor="favorites" className="text-[10px] font-black uppercase tracking-widest cursor-pointer text-white/40 group-hover:text-white/80 transition-colors">Favoritos</Label>
            </div>
          </div>
        </div>
      )}
    </TactileCard>
  );
};

export default RadarFilters;
