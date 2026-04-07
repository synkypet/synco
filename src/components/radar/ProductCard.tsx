// src/components/radar/ProductCard.tsx
import React from 'react';
import { TactileCard } from '@/components/ui/TactileCard';
import { Badge } from '@/components/ui/badge';
import { KineticButton } from '@/components/ui/KineticButton';
import { Button } from '@/components/ui/button';
import {
  Heart, Copy, MoreVertical, Eye, Megaphone,
  Zap, Truck, Tag, CheckSquare, Square, Store, CheckCircle2, Star
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Product } from '@/types/product';

interface ProductCardProps {
  product: Product;
  isSelected: boolean;
  onToggleFavorite?: (id: string, isFavorite: boolean) => void;
  onSelect?: (product: Product) => void;
  onViewDetails?: (product: Product) => void;
  onAddToCampaign?: (product: Product) => void;
}

const TAG_COLORS: Record<string, string> = {
  'Oferta Forte': 'bg-red-500/10 text-red-600 border-red-500/20',
  'Tendência': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  'Menor Preço': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Cupom Bom': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
};

const MARKETPLACE_COLORS: Record<string, string> = {
  Shopee: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  'Mercado Livre': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  Amazon: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  Magalu: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  AliExpress: 'bg-red-500/10 text-red-600 border-red-500/20',
  Shein: 'bg-black/10 text-black border-black/20',
};

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isSelected,
  onToggleFavorite,
  onSelect,
  onViewDetails,
  onAddToCampaign
}) => {
  const copyLink = () => {
    const link = product.original_url || '#';
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  const score = product.opportunity_score || 0;
  const scoreColor = score >= 90 ? 'text-green-500' : score >= 75 ? 'text-yellow-500' : 'text-muted-foreground';

  return (
    <TactileCard
      variant={isSelected ? "elevated" : "flat"}
      className={cn(
        "overflow-hidden transition-all duration-300 group relative flex flex-col h-full",
        isSelected && "shadow-[0_0_20px_rgba(255,107,0,0.2)]"
      )}
    >
      {/* Imagem - Skeuo pressed cavity */}
      <div className="relative h-52 overflow-hidden bg-deep-void shadow-skeuo-pressed m-2 rounded-xl">
        <img
          src={product.image_url || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop'}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-80 group-hover:opacity-100"
          onError={(e: any) => { e.target.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop'; }}
        />

        {/* Badges no topo */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.discount_percent && (
            <Badge className="bg-red-500 text-white text-[10px] font-bold border-0 px-1.5 h-5">
              -{product.discount_percent}%
            </Badge>
          )}
          {product.coupon && (
            <Badge className="bg-yellow-500/90 text-white text-[10px] border-0 px-1.5 h-5">
              <Tag className="w-2.5 h-2.5 mr-0.5" />Cupom
            </Badge>
          )}
        </div>

        {/* Score - Neon Glow for top tier */}
        <div className="absolute top-2 right-2">
          <div className={cn(
            "rounded-lg px-2 py-1 backdrop-blur-md shadow-skeuo-elevated",
            score >= 90 ? "bg-kinetic-orange/20 shadow-glow-orange" : "bg-black/40"
          )}>
            <span className={cn(
              "text-[10px] font-black font-headline",
              score >= 90 ? "text-kinetic-orange" : score >= 75 ? "text-yellow-500" : "text-white/40"
            )}>
              {score}
            </span>
          </div>
        </div>

        {/* Botão de seleção - canto inferior esquerdo */}
        {onSelect && (
          <button
            onClick={() => onSelect(product)}
            className={cn(
              "absolute bottom-2 left-2 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
              isSelected
                ? "bg-kinetic-orange text-white shadow-glow-orange scale-110"
                : "bg-black/40 backdrop-blur-md hover:bg-white/10 text-white/40 hover:text-white"
            )}
          >
            {isSelected ? <CheckCircle2 className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          </button>
        )}

        {/* Botão favorito */}
        <button
          onClick={() => onToggleFavorite && onToggleFavorite(product.id, !product.is_favorite)}
          className="absolute bottom-2 right-2 w-8 h-8 rounded-lg bg-black/40 backdrop-blur-md flex items-center justify-center hover:bg-red-500/10 transition-all duration-300"
        >
          <Heart className={cn("w-4 h-4 transition-colors", product.is_favorite ? "fill-red-500 text-red-500" : "text-white/30")} />
        </button>
      </div>

      {/* Conteúdo */}
      <div className="p-3 flex flex-col flex-1">
        {/* Marketplace */}
        <div className="flex items-center justify-between mb-2">
          <Badge variant="outline" className={cn(
            "text-[9px] px-2 h-4 font-bold uppercase tracking-widest border-none bg-white/5",
            MARKETPLACE_COLORS[product.marketplace] ? "text-white/60" : "text-white/30"
          )}>
            <Store className="w-2.5 h-2.5 mr-1" />{product.marketplace}
          </Badge>
          {product.free_shipping && (
            <span className="text-[9px] text-emerald-500 flex items-center gap-0.5 font-bold uppercase tracking-tighter">
              <Truck className="w-3 h-3" /> Grátis
            </span>
          )}
        </div>

        {/* Nome */}
        <h3 className="text-sm font-bold line-clamp-2 mb-3 leading-tight h-10 text-white/90 group-hover:text-white transition-colors">
          {product.name}
        </h3>

        {/* Preços - Deep-void cavity */}
        <div className="bg-deep-void/50 rounded-xl px-3 py-2 shadow-skeuo-pressed mb-3 flex items-baseline gap-2">
          {product.original_price && (
            <span className="text-[10px] text-white/20 line-through font-medium">R$ {product.original_price.toFixed(2)}</span>
          )}
          <span className={cn(
            "text-2xl font-black font-headline text-kinetic-orange tracking-tight",
            score >= 90 && "shadow-glow-orange-intense neon-glow"
          )}>
            R$ {product.current_price?.toFixed(2)}
          </span>
        </div>

        {/* Comissão */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest leading-none mb-1">Comissão</span>
            <span className="text-xs font-black text-emerald-500 font-headline">
              {product.commission_percent}% · R$ {product.commission_value?.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded-lg">
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
            <span className="text-[10px] font-bold text-white/50">{product.rating}</span>
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-2 mt-auto">
          <KineticButton
            className={cn(
              "flex-1 h-10 text-[10px] font-bold uppercase tracking-widest",
              isSelected && "bg-white/5 text-white/50 shadow-skeuo-pressed"
            )}
            onClick={() => onSelect && onSelect(product)}
          >
            {isSelected ? (
              <><CheckCircle2 className="w-3 h-3 mr-2" />Selecionado</>
            ) : (
              <><Zap className="w-3 h-3 mr-2" />Selecionar</>
            )}
          </KineticButton>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-10 w-10 p-0 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all shadow-skeuo-flat hover:shadow-skeuo-elevated" 
            onClick={copyLink}
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-10 w-10 p-0 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all shadow-skeuo-flat hover:shadow-skeuo-elevated"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-anthracite-surface border-none shadow-skeuo-elevated rounded-2xl p-1">
              <DropdownMenuItem onClick={() => onViewDetails && onViewDetails(product)} className="text-xs font-medium rounded-xl hover:bg-white/5 text-white/70">
                <Eye className="w-4 h-4 mr-2" /> Ver detalhes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddToCampaign && onAddToCampaign(product)} className="text-xs font-medium rounded-xl hover:bg-white/5 text-white/70">
                <Megaphone className="w-4 h-4 mr-2" /> Adicionar à campanha
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs font-medium rounded-xl hover:bg-white/5 text-kinetic-orange">
                <Zap className="w-4 h-4 mr-2" /> Criar automação
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </TactileCard>
  );
};

export default ProductCard;
