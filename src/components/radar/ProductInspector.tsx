/* eslint-disable @next/next/no-img-element */
// src/components/radar/ProductInspector.tsx
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KineticButton } from "@/components/ui/KineticButton";
import { Product } from "@/types/product";
import { 
  Star, 
  ShoppingCart, 
  TrendingUp, 
  ExternalLink, 
  Store, 
  Info,
  ChevronRight,
  ShieldCheck,
  Zap,
  Globe
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductInspectorProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (product: Product) => void;
  isSelected?: boolean;
}

export const ProductInspector: React.FC<ProductInspectorProps> = ({
  product,
  isOpen,
  onClose,
  onSelect,
  isSelected
}) => {
  if (!product) return null;

  const commissionValue = product.commission_value || 0;
  const commissionPercent = product.commission_percent || 0;
  const rating = product.rating || 4.8;
  const salesCount = product.sales_count || 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-deep-void border-none shadow-skeuo-elevated rounded-[32px] p-0 overflow-hidden outline-none">
        <DialogHeader className="sr-only">
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-full max-h-[90vh]">
          {/* 1. ZONA DE DECISÃO RÁPIDA (SEM SCROLL) */}
          <div className="p-6 pb-2">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Imagem Premium */}
              <div className="relative w-full md:w-64 h-64 shrink-0 bg-anthracite-surface rounded-[24px] overflow-hidden shadow-skeuo-pressed border border-white/5">
                <img 
                  src={product.image_url} 
                  alt={product.name} 
                  className="w-full h-full object-cover opacity-90"
                />
                {product.discount_percent && (
                  <div className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-glow-orange-intense">
                    -{product.discount_percent}%
                  </div>
                )}
              </div>

              {/* Infos Primárias */}
              <div className="flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-2">
                   <Badge variant="outline" className="bg-white/5 border-none text-[8px] font-black tracking-widest text-white/40">
                      {product.marketplace.toUpperCase()}
                   </Badge>
                   {product.official_store && (
                     <Badge className="bg-emerald-500/10 text-emerald-500 border-none text-[8px] font-black tracking-widest flex items-center gap-1">
                        <ShieldCheck size={10} /> OFICIAL
                     </Badge>
                   )}
                </div>

                <h2 className="text-lg font-black text-white leading-tight mb-4 line-clamp-2">
                  {product.name}
                </h2>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Preço */}
                  <div className="bg-anthracite-surface/50 p-3 rounded-2xl shadow-skeuo-flat border border-white/5">
                    <span className="text-[9px] font-black text-white/20 uppercase tracking-widest block mb-1">Preço Atual</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-black text-white">R$ {product.current_price?.toFixed(2)}</span>
                      {product.original_price && (
                        <span className="text-[10px] text-white/20 line-through">R$ {product.original_price?.toFixed(2)}</span>
                      )}
                    </div>
                  </div>

                  {/* Comissão - DESTAQUE MÁXIMO */}
                  <div className="bg-kinetic-orange/10 p-3 rounded-2xl shadow-glow-orange border border-kinetic-orange/20">
                    <span className="text-[9px] font-black text-kinetic-orange uppercase tracking-widest block mb-1">Seu Retorno</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-black text-kinetic-orange">R$ {commissionValue.toFixed(2)}</span>
                      <span className="text-[10px] font-black text-kinetic-orange/40">{commissionPercent}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between px-2">
                   <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <Star size={14} className="text-yellow-500 fill-yellow-500" />
                        <span className="text-xs font-black text-white/80">{rating}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <TrendingUp size={14} className="text-emerald-500" />
                        <span className="text-xs font-black text-white/80">{salesCount}+ vendidos</span>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. ZONA DE CONTEXTO & TÉCNICA (SCROLL) */}
          <div className="flex-1 overflow-y-auto p-6 pt-2 custom-scrollbar">
            <div className="space-y-4">
               {/* Contexto da Loja */}
               <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5 shadow-skeuo-pressed">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shadow-skeuo-flat">
                       <Store size={18} className="text-white/40" />
                    </div>
                    <div>
                       <span className="text-[8px] font-black text-white/20 uppercase tracking-widest block">Vendedor</span>
                       <span className="text-sm font-bold text-white/80">{product.store_name || "Loja Shopee"}</span>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    className="h-10 px-4 bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-widest rounded-xl gap-2"
                    onClick={() => window.open(product.original_url, '_blank')}
                  >
                    Abrir na Shopee <ExternalLink size={12} />
                  </Button>
               </div>

               {/* Seção Técnica Colapsada */}
               <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="tech-details" className="border-none">
                    <AccordionTrigger className="hover:no-underline py-3 px-4 bg-white/[0.01] rounded-xl text-white/20 hover:text-white/40 transition-colors">
                       <div className="flex items-center gap-2">
                          <Info size={14} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Detalhes Técnicos</span>
                       </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 px-4">
                       <div className="grid grid-cols-1 gap-3">
                          <div className="p-3 bg-black/40 rounded-xl border border-white/5 font-mono text-[10px] space-y-2">
                             <div className="flex justify-between">
                                <span className="text-white/20">ITEM_ID</span>
                                <span className="text-white/60">{product.id}</span>
                             </div>
                             <div className="flex justify-between">
                                <span className="text-white/20">MARKETPLACE</span>
                                <span className="text-white/60">{product.marketplace}</span>
                             </div>
                             <div className="flex flex-col gap-1">
                                <span className="text-white/20">RAW_URL</span>
                                <span className="text-white/40 break-all leading-relaxed">{product.original_url}</span>
                             </div>
                             <div className="flex justify-between">
                                <span className="text-white/20">LAST_SYNC</span>
                                <span className="text-white/60">{product.updated_at ? new Date(product.updated_at).toLocaleString() : 'N/A'}</span>
                             </div>
                          </div>
                       </div>
                    </AccordionContent>
                  </AccordionItem>
               </Accordion>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 bg-anthracite-surface/80 backdrop-blur-md border-t border-white/5 flex gap-3">
             <Button 
                variant="ghost" 
                onClick={onClose}
                className="h-12 px-6 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white"
             >
                Fechar
             </Button>
             <KineticButton
                onClick={() => {
                  onSelect?.(product);
                  onClose();
                }}
                className="flex-1 h-12 text-[10px] font-black uppercase tracking-widest"
             >
                {isSelected ? <><Zap size={16} className="mr-2" /> Remover Seleção</> : <><Zap size={16} className="mr-2" /> Promover Oportunidade</>}
             </KineticButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
