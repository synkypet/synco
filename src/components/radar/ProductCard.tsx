/* eslint-disable @next/next/no-img-element */
// src/components/radar/ProductCard.tsx
import React from 'react';
import { TactileCard } from '@/components/ui/TactileCard';
import { Badge } from '@/components/ui/badge';
import { KineticButton } from '@/components/ui/KineticButton';
import { Button } from '@/components/ui/button';
import {
  Zap, Truck, Tag, CheckSquare, Square, Store, CheckCircle2, Star, Loader2, AlertTriangle, ExternalLink, RefreshCw, Pin, PinOff, TrendingUp, Copy, MoreVertical, Eye
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
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
  onAudit?: (product: Product) => Promise<void>;
  onTogglePin?: (product: Product) => void;
  isPinned?: boolean;
}

const MARKETPLACE_COLORS: Record<string, string> = {
  Shopee: 'text-orange-500',
  'Mercado Livre': 'text-yellow-500',
  Amazon: 'text-blue-500',
  Magalu: 'text-indigo-500',
  AliExpress: 'text-red-500',
  Shein: 'text-white',
};

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isSelected,
  onToggleFavorite,
  onSelect,
  onViewDetails,
  onAddToCampaign,
  onAudit,
  onTogglePin,
  isPinned
}) => {
  const copyLink = () => {
    const link = product.original_url || '#';
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  const score = product.opportunity_score || 0;
  const isDead = product.status === 'dead';

  return (
    <TactileCard
      variant={isSelected ? "elevated" : "flat"}
      className={cn(
        "overflow-hidden transition-all duration-300 group relative flex flex-col h-full border-none",
        isSelected && "shadow-[0_0_25px_rgba(255,107,0,0.25)] ring-1 ring-kinetic-orange/40",
        !isSelected && score >= 90 && "hover:shadow-glow-orange ring-kinetic-orange/10",
        isDead && "opacity-70 grayscale-[0.5]"
      )}
    >
      {/* Imagem - Premium Cavity */}
      <div className="relative h-48 overflow-hidden bg-deep-void shadow-skeuo-pressed m-1.5 rounded-[20px]">
        <img
          src={product.image_url || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop'}
          alt={product.name}
          className={cn(
            "w-full h-full object-cover transition-all duration-700",
            !isDead ? "opacity-90 group-hover:opacity-100 group-hover:scale-110" : "opacity-40"
          )}
          onError={(e: any) => { e.target.src = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop'; }}
        />

        {/* Overlay Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
          {product.discount_percent && (
            <div className="bg-emerald-500 text-white text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-lg shadow-[0_0_10px_rgba(16,185,129,0.3)]">
              -{product.discount_percent}%
            </div>
          )}
          {product.coupon && (
            <div className="bg-yellow-500 text-black text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg shadow-lg flex items-center">
              <Tag className="w-3 h-3 mr-1" /> Cupom
            </div>
          )}
        </div>

        {/* Score Ring */}
        <div className="absolute top-2.5 right-2.5">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md shadow-skeuo-elevated border border-white/10",
            score >= 90 ? "bg-kinetic-orange/20 shadow-glow-orange border-kinetic-orange/30" : "bg-black/60"
          )}>
            <span className={cn(
              "text-[10px] font-black",
              score >= 90 ? "text-kinetic-orange" : "text-white/60"
            )}>
              {score}
            </span>
          </div>
        </div>

        {/* Quick Actions Overlay */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
          <button
            onClick={(e) => { e.stopPropagation(); onSelect?.(product); }}
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center backdrop-blur-md transition-all shadow-lg",
              isSelected ? "bg-kinetic-orange text-white" : "bg-white/10 text-white/70 hover:bg-white/20"
            )}
          >
            {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          </button>
          
        </div>
      </div>

      {/* Info Content */}
      <div className="px-4 py-3 flex flex-col flex-1">
        {/* Marketplace & Status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <div className={cn("w-1.5 h-1.5 rounded-full", isDead ? "bg-red-500" : "bg-emerald-500 animate-pulse")} />
            <span className={cn("text-[8px] font-black uppercase tracking-[0.2em]", MARKETPLACE_COLORS[product.marketplace] || "text-white/40")}>
              {product.marketplace}
            </span>
          </div>

          <div className="flex items-center gap-2">
             {product.status && (
              <span className={cn(
                "text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md",
                product.status === 'eligible' && "bg-emerald-500/10 text-emerald-500",
                product.status === 'review_needed' && "bg-yellow-500/10 text-yellow-500",
                product.status === 'dead' && "bg-red-500/10 text-red-500",
                product.status === 'audit_failed' && "bg-white/10 text-white/30"
              )}>
                {product.status === 'eligible' ? 'Factual' : product.status === 'dead' ? 'Morto' : 'Revisar'}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-[13px] font-bold text-white/80 line-clamp-2 leading-snug mb-3 group-hover:text-white transition-colors h-9">
          {product.name}
        </h3>

        {/* Price Display - Skeuo Cavity */}
        <div className="bg-deep-void shadow-skeuo-pressed rounded-[14px] p-2.5 mb-3 border border-white/[0.02]">
          <div className="flex items-baseline gap-1.5 mb-0.5">
            <span className="text-[10px] font-black text-kinetic-orange uppercase tracking-widest opacity-50">Por</span>
            <span className={cn(
              "text-xl font-black font-headline text-kinetic-orange tracking-tight",
              score >= 90 && "drop-shadow-[0_0_8px_rgba(255,107,0,0.4)]"
            )}>
              R$ {product.current_price?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            {product.original_price && product.original_price > (product.current_price || 0) ? (
              <span className="text-[9px] text-white/20 font-bold line-through">
                R$ {product.original_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            ) : <div />}
            
            <span className="text-[8px] text-white/10 font-black uppercase tracking-tighter">
              Verificado {product.updated_at ? new Date(product.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recente'}
            </span>
          </div>
        </div>

        {/* Operational Specs */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-white/[0.03] rounded-lg p-1.5 flex flex-col">
            <span className="text-[7px] font-black text-white/20 uppercase tracking-widest mb-0.5">Comissão</span>
            <span className="text-[10px] font-black text-emerald-500 font-headline">
              {product.commission_percent}% · R$ {product.commission_value?.toFixed(2)}
            </span>
          </div>
          <div className="bg-white/[0.03] rounded-lg p-1.5 flex flex-col">
            <span className="text-[7px] font-black text-white/20 uppercase tracking-widest mb-0.5">Vendas</span>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-2.5 h-2.5 text-emerald-500" />
              <span className="text-[10px] font-black text-white/60">
                {(product.sales_count || 0).toLocaleString('pt-BR')}+
              </span>
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex gap-2 mt-auto">
          <KineticButton
            disabled={isDead}
            onClick={() => onSelect?.(product)}
            className={cn(
              "flex-1 h-10 text-[10px] font-black uppercase tracking-widest",
              isSelected && "bg-white/5 text-white/40 shadow-skeuo-pressed pointer-events-none"
            )}
          >
            {isSelected ? (
              <><CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Selecionado</>
            ) : (
              <><Zap className="w-3.5 h-3.5 mr-2" /> Selecionar</>
            )}
          </KineticButton>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-10 h-10 p-0 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white shadow-skeuo-flat border-none"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-anthracite-surface border-none shadow-skeuo-elevated rounded-xl p-1.5 z-50">
              <DropdownMenuItem onClick={copyLink} className="text-[10px] font-black uppercase tracking-widest p-3 rounded-lg hover:bg-white/5">
                <Copy className="w-3.5 h-3.5 mr-2" /> Copiar Link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewDetails?.(product)} className="text-[10px] font-black uppercase tracking-widest p-3 rounded-lg hover:bg-white/5">
                <Eye className="w-3.5 h-3.5 mr-2" /> Ver Detalhes
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </TactileCard>
  );
};

export default ProductCard;
