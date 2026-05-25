'use client';

import React from 'react';
import { 
  Tag, 
  ExternalLink, 
  Info, 
  Copy, 
  ZapOff, 
  Activity,
  CheckCircle2,
  Link as LinkIcon,
  Pencil,
  Loader2,
  Zap
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { KineticButton } from '@/components/ui/KineticButton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { DiscoveredCoupon } from '@/hooks/use-discovered-coupons';
import { formatShopeeCouponMessage, getCouponPrimaryUrl } from '@/lib/marketplaces/shopee/coupon-formatter';

interface DiscoveredCouponCardProps {
  coupon: DiscoveredCoupon;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
  onReject?: (id: string) => void;
  onReaffiliate?: (id: string) => void;
}

/**
 * Card para exibição de cupons detectados pelo radar.
 * Redesenhado para ser limpo e operacional (Fase B).
 */
export const DiscoveredCouponCard: React.FC<DiscoveredCouponCardProps> = ({ 
  coupon, 
  isSelected = false, 
  onToggleSelection,
  onReject,
  onReaffiliate
}) => {
  const router = useRouter();
  const [isEditing, setIsEditing] = React.useState(false);
  const [editLabel, setEditLabel] = React.useState(coupon.coupon_label || '');
  const [currentLabel, setCurrentLabel] = React.useState(coupon.coupon_label || '');
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setCurrentLabel(coupon.coupon_label || '');
  }, [coupon.coupon_label]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLabel.trim()) {
      toast.error('O título do cupom não pode ser vazio.');
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/shopee/discovered-coupons/${coupon.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coupon_label: editLabel.trim() })
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao salvar alterações.');
      }
      
      setCurrentLabel(editLabel.trim());
      setIsEditing(false);
      toast.success('Nome do cupom atualizado com sucesso!', {
        icon: <CheckCircle2 className="text-emerald-400" size={16} />
      });
    } catch (err: any) {
      console.error('[UI-EDIT-COUPON] Erro:', err);
      toast.error(err.message || 'Falha ao salvar. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };
  
  const primaryLink = getCouponPrimaryUrl(coupon);
  const hasLink = !!primaryLink;

  const handleCopyMessage = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!primaryLink || primaryLink === 'undefined') {
      toast.error('Não é possível copiar: link de resgate ausente ou inválido.');
      return;
    }

    console.log('[COUPON-CARD-ACTION]', {
      action: 'copy',
      couponId: coupon.id,
      couponCode: coupon.code,
      couponLabel: currentLabel,
      primaryUrl: primaryLink
    });

    const formattedMessage = formatShopeeCouponMessage({
      marketplace: 'shopee',
      type: coupon.coupon_type,
      code: coupon.code,
      couponLabel: currentLabel,
      redemptionUrl: primaryLink,
      confidence: coupon.confidence,
      status: coupon.status,
      dedupeKey: coupon.dedupe_key
    });

    if (!formattedMessage) {
      toast.error('Erro ao formatar mensagem. Verifique a integridade do cupom.');
      return;
    }

    navigator.clipboard.writeText(formattedMessage);
    
    toast.success('Mensagem copiada!', {
      description: 'A mensagem formatada está pronta para colagem manual.',
      icon: <Copy className="text-kinetic-orange" size={16} />,
      duration: 2000
    });
  };

  const handleOpenLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (primaryLink) {
      console.log('[COUPON-CARD-ACTION]', {
        action: 'open',
        couponId: coupon.id,
        couponCode: coupon.code,
        couponLabel: currentLabel,
        primaryUrl: primaryLink
      });
      window.open(primaryLink, '_blank');
    } else {
      toast.error('URL de resgate não disponível.');
    }
  };

  const handleQuickSend = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!primaryLink) {
      toast.error('Não é possível enviar: link de resgate ausente ou inválido.');
      return;
    }

    console.log('[COUPON-CARD-ACTION]', {
      action: 'quick_send',
      couponId: coupon.id,
      couponCode: coupon.code || null,
      couponLabel: currentLabel || null,
      primaryUrl: primaryLink,
      redemptionUrl: coupon.redemption_url || null,
      sourceUrl: coupon.source_url || null
    });

    const stored = {
      links: primaryLink,
      coupons: [
        {
          couponId: coupon.id,
          inputUrl: primaryLink,
          couponCode: coupon.code ?? null,
          couponLabel: currentLabel ?? null,
          couponType: coupon.coupon_type ?? null,
          redemptionUrl: coupon.redemption_url ?? null,
          sourceUrl: coupon.source_url ?? null
        }
      ],
      timestamp: Date.now()
    };
    
    localStorage.setItem('quick_send_draft', JSON.stringify(stored));
    toast.success('Cupom preparado para o Envio Rápido!');
    router.push('/envio-rapido');
  };

  const handleReaffiliate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReaffiliate?.(coupon.id);
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

        {/* Botão de Rejeição Rápida / Lixeira */}
        <button
          id={`delete-coupon-${coupon.id}`}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log(`[UI] Clicado em excluir cupom: ${coupon.id}`);
            onReject?.(coupon.id);
          }}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-xl bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 active:scale-95 transition-all flex items-center justify-center border border-red-500/20 shadow-skeuo-flat"
          title="Remover cupom permanentemente"
        >
          <Trash2Icon size={18} />
        </button>

        {/* Header Simplificado: Status de Afiliação */}
        <div className="flex items-center justify-between mb-6 pl-6">
          <div className="flex flex-col gap-1.5">
            {!coupon.redemption_url && (
              <Badge className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border-none bg-red-500/10 text-red-400">
                Link Inválido
              </Badge>
            )}
            {coupon.redemption_url && coupon.reaffiliation_status === 'reaffiliated' && (
              <Badge className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border-none flex items-center gap-1.5 w-fit shadow-sm bg-emerald-500/10 text-emerald-400">
                <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                Pronto para uso
              </Badge>
            )}
          </div>

          <Badge className="bg-white/5 text-white/40 border-white/10 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1.5">
            {currentType.icon}
            {currentType.label}
          </Badge>
        </div>

        {/* Content Principal: Código e Label */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] font-black text-kinetic-orange tracking-tighter font-headline italic leading-none">
                {coupon.code || 'SEM CÓDIGO'}
              </span>
              {coupon.capture_count > 1 && (
                <span className="text-[10px] text-white/20 font-black uppercase tracking-widest">
                  {coupon.capture_count}x visto
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <h4 className="text-[12px] font-bold text-white/70 uppercase tracking-wide leading-tight line-clamp-1">
                {currentLabel || 'Cupom Shopee'}
              </h4>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditLabel(currentLabel);
                  setIsEditing(true);
                }}
                className="p-1 rounded bg-white/5 text-white/40 hover:text-kinetic-orange hover:bg-white/10 active:scale-95 transition-all"
                title="Editar nome do cupom"
              >
                <Pencil size={10} />
              </button>
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2">
            
            <KineticButton 
              onClick={handleCopyMessage}
              disabled={!hasLink}
              className={cn(
                "flex-1 h-12 rounded-2xl bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border-white/5 group/btn shadow-skeuo-flat",
                !hasLink && "opacity-50 cursor-not-allowed"
              )}
            >
              <Copy size={14} className="mr-2 group-hover/btn:scale-110 transition-transform" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em]">{hasLink ? 'Copiar' : 'Link Ausente'}</span>
            </KineticButton>
            
            <button 
              onClick={handleOpenLink}
              className="h-12 w-12 flex items-center justify-center rounded-2xl bg-kinetic-orange/10 text-kinetic-orange hover:bg-kinetic-orange/20 transition-all shadow-skeuo-flat border-none"
              title="Abrir link de resgate"
            >
              <ExternalLink size={16} />
            </button>

            <button 
              onClick={handleQuickSend}
              disabled={!hasLink}
              className={cn(
                "h-12 w-12 flex items-center justify-center rounded-2xl bg-kinetic-orange text-white hover:shadow-glow-orange transition-all shadow-skeuo-flat border-none",
                !hasLink && "opacity-50 cursor-not-allowed"
              )}
              title="Enviar para Envio Rápido"
            >
              <Zap size={16} />
            </button>
          </div>
        </div>

        {/* Efeito de Gloss Inferior */}
        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-kinetic-orange/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Modal Skeuomórfico de Edição */}
      {isEditing && (
        <div 
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(false);
          }}
        >
          <div 
            className="w-full max-w-md bg-anthracite-surface rounded-[24px] shadow-skeuo-elevated border border-white/[0.05] p-6 relative overflow-hidden text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gloss de Luz */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-kinetic-orange to-transparent" />
            
            <h3 className="text-sm font-black uppercase tracking-wider text-white mb-4">
              Editar Nome do Cupom
            </h3>
            
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-white/40 mb-1.5">
                  Código do Cupom (Não Editável)
                </label>
                <input 
                  type="text" 
                  disabled 
                  value={coupon.code || 'SEM CÓDIGO'} 
                  className="w-full h-12 px-4 bg-deep-void/60 text-white/50 rounded-2xl border border-white/5 font-mono font-bold text-[13px] cursor-not-allowed shadow-skeuo-pressed"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-white/40 mb-1.5">
                  Título / Nome do Cupom
                </label>
                <input 
                  type="text" 
                  value={editLabel} 
                  onChange={(e) => setEditLabel(e.target.value)}
                  required
                  placeholder="Ex: Cupom de R$ 15 OFF"
                  className="w-full h-12 px-4 bg-deep-void text-white rounded-2xl border border-white/5 focus:border-kinetic-orange focus:outline-none font-bold text-[13px] shadow-skeuo-pressed transition-colors"
                  disabled={isSaving}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="h-10 px-4 rounded-xl text-white/50 bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-[10px] font-black uppercase tracking-wider"
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-10 px-4 rounded-xl bg-kinetic-orange text-white hover:shadow-glow-orange active:scale-95 transition-all text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="animate-spin" size={12} />
                      Salvando...
                    </>
                  ) : (
                    'Salvar'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

function Trash2Icon({ size }: { size: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}
