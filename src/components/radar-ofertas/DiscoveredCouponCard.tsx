'use client';

import React from 'react';
import { 
  Calendar, 
  Tag, 
  ExternalLink, 
  Info, 
  Copy, 
  ZapOff, 
  Activity,
  CheckCircle2,
  Clock,
  Link as LinkIcon,
  Trash2
} from 'lucide-react';
import { KineticButton } from '@/components/ui/KineticButton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { DiscoveredCoupon } from '@/hooks/use-discovered-coupons';
import { formatShopeeCouponMessage } from '@/lib/marketplaces/shopee/coupon-formatter';

interface DiscoveredCouponCardProps {
  coupon: DiscoveredCoupon;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
  onReject?: (id: string) => void;
}

/**
 * Card para exibição de cupons detectados pelo radar.
 * Focado em curadoria manual segura, sem botões de disparo automático.
 */
export const DiscoveredCouponCard: React.FC<DiscoveredCouponCardProps> = ({ 
  coupon, 
  isSelected = false, 
  onToggleSelection,
  onReject
}) => {
  
  const handleCopyMessage = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const formattedMessage = formatShopeeCouponMessage({
      marketplace: 'shopee',
      type: coupon.coupon_type,
      code: coupon.code,
      couponLabel: coupon.coupon_label,
      redemptionUrl: coupon.effective_redemption_url || coupon.redemption_url,
      confidence: coupon.confidence,
      status: coupon.status,
      dedupeKey: coupon.dedupe_key
    });

    navigator.clipboard.writeText(formattedMessage);
    
    toast.success('Mensagem copiada!', {
      description: 'A mensagem formatada está pronta para colagem manual.',
      icon: <Copy className="text-kinetic-orange" size={16} />,
      duration: 2000
    });
  };

  const handleOpenLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const targetUrl = coupon.effective_redemption_url || coupon.redemption_url;
    if (targetUrl) {
      window.open(targetUrl, '_blank');
    } else {
      toast.error('URL de resgate não disponível.');
    }
  };

  const statusConfig = {
    candidate: { label: 'Candidato', color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/20' },
    unknown: { label: 'Desconhecido', color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/20' },
    valid: { label: 'Válido', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20 shadow-glow-emerald/10' },
    expired: { label: 'Expirado', color: 'bg-red-500/20 text-red-400 border-red-500/20' },
  };

  const typeConfig = {
    codigo: { label: 'Código', icon: <Tag size={12} /> },
    link_resgate: { label: 'Link de Resgate', icon: <LinkIcon size={12} /> },
    pagina_cupons: { label: 'Página de Cupons', icon: <Activity size={12} /> },
  };

  const currentStatus = statusConfig[coupon.status] || statusConfig.unknown;
  const currentType = typeConfig[coupon.coupon_type] || { label: 'Outro', icon: <Tag size={12} /> };

  return (
    <div 
      className={cn(
        "group relative cursor-pointer",
        isSelected && "scale-[1.02] transition-transform"
      )}
      onClick={() => onToggleSelection?.(coupon.id)}
    >
      <div className={cn(
        "relative bg-anthracite-surface rounded-[24px] overflow-hidden shadow-skeuo-flat border border-white/[0.03] transition-all duration-300 p-6",
        isSelected ? "shadow-glow-orange/20 border-kinetic-orange/30 ring-1 ring-kinetic-orange/20" : "hover:shadow-glow-orange/5 hover:translate-y-[-2px]"
      )}>
        
        {/* Checkbox de Seleção */}
        <div className={cn(
          "absolute top-4 left-4 z-10 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
          isSelected 
            ? "bg-kinetic-orange border-kinetic-orange text-white shadow-glow-orange" 
            : "bg-black/20 border-white/10 opacity-0 group-hover:opacity-100"
        )}>
          {isSelected && <CheckCircle2 size={12} strokeWidth={4} />}
        </div>

        {/* Botão de Rejeição Rápida */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReject?.(coupon.id);
          }}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-lg bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all flex items-center justify-center border border-red-500/20"
          title="Remover cupom"
        >
          <Trash2 size={14} />
        </button>

        {/* Header: Tipo e Status */}
        <div className="flex items-center justify-between mb-4 pl-6">
          <Badge className={cn("px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border-none flex items-center gap-1.5", currentStatus.color)}>
            <div className={cn("w-1.5 h-1.5 rounded-full bg-current animate-pulse")} />
            {currentStatus.label}
          </Badge>

          <div className="flex items-center gap-2">
             <Badge className="bg-white/5 text-white/40 border-white/10 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1.5">
               {currentType.icon}
               {currentType.label}
             </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-4">
          <div>
            <h4 className="text-[14px] font-black text-white/90 uppercase tracking-wider leading-tight line-clamp-2 min-h-[36px] font-headline italic">
              {coupon.coupon_label || (coupon.code ? `Cupom: ${coupon.code}` : 'Cupom Shopee Detectado')}
            </h4>
            
            <div className="flex flex-wrap items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-white/30">
                <Clock size={10} className="text-kinetic-orange" />
                <span className="text-[9px] font-bold uppercase tracking-widest">
                  Visto em: {new Date(coupon.last_seen_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-white/30">
                <CheckCircle2 size={10} className="text-kinetic-orange" />
                <span className="text-[9px] font-bold uppercase tracking-widest">
                  Confiança: {(coupon.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          {/* Código e Capturas */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-deep-void/40 p-3 rounded-xl border border-white/5 shadow-skeuo-pressed flex flex-col justify-center">
              <span className="text-[7px] font-black text-white/20 uppercase tracking-widest mb-1">Código</span>
              <span className="text-[11px] font-black text-kinetic-orange tracking-widest truncate">
                {coupon.code || 'N/A'}
              </span>
            </div>
            <div className="bg-deep-void/40 p-3 rounded-xl border border-white/5 shadow-skeuo-pressed flex flex-col justify-center">
              <span className="text-[7px] font-black text-white/20 uppercase tracking-widest mb-1">Capturas</span>
              <span className="text-[11px] font-black text-white/60 tracking-widest">
                {coupon.capture_count}x
              </span>
            </div>
          </div>

          {/* Badge de Segurança Obrigatória e Re-afiliação */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/5 border border-amber-500/10 rounded-xl">
               <ZapOff size={12} className="text-amber-500/50" />
               <span className="text-[9px] font-black uppercase tracking-widest text-amber-500/60 leading-none">
                 🔒 Envio automático bloqueado
               </span>
            </div>

            {coupon.redemption_url && (
              <div className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl border",
                coupon.reaffiliation_status === 'reaffiliated' 
                  ? "bg-emerald-500/5 border-emerald-500/10" 
                  : "bg-red-500/5 border-red-500/10"
              )}>
                {coupon.reaffiliation_status === 'reaffiliated' ? (
                  <CheckCircle2 size={12} className="text-emerald-500/50" />
                ) : (
                  <Info size={12} className="text-red-500/50" />
                )}
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-widest leading-none",
                  coupon.reaffiliation_status === 'reaffiliated' ? "text-emerald-500/60" : "text-red-500/60"
                )}>
                  {coupon.reaffiliation_status === 'reaffiliated' 
                    ? "✓ Link re-afiliado" 
                    : "⚠ Link ainda não re-afiliado"}
                </span>
              </div>
            )}
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2 mt-2">
            <KineticButton 
              onClick={handleCopyMessage}
              className="flex-1 h-12 rounded-2xl bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border-white/5 group/btn shadow-skeuo-flat"
            >
              <Copy size={14} className="mr-2 group-hover/btn:scale-110 transition-transform" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em]">Copiar</span>
            </KineticButton>
            
            <button 
              onClick={handleOpenLink}
              className="h-12 w-12 flex items-center justify-center rounded-2xl bg-kinetic-orange/10 text-kinetic-orange hover:bg-kinetic-orange/20 transition-all shadow-skeuo-flat border-none"
              title="Abrir link de resgate"
            >
              <ExternalLink size={16} />
            </button>
            
            <button 
              className="h-12 w-12 flex items-center justify-center rounded-2xl bg-white/5 text-white/20 hover:text-white/40 transition-all shadow-skeuo-flat border-white/5"
              title="Detalhes Técnicos"
              onClick={() => toast.info('Chave Dedupe: ' + coupon.dedupe_key)}
            >
              <Info size={16} />
            </button>
          </div>
        </div>

        {/* Efeito de Gloss Inferior */}
        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-kinetic-orange/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
};
