'use client';

import React from 'react';
import { 
  Zap, 
  ExternalLink, 
  Copy, 
  Clock, 
  Activity, 
  ShieldAlert,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Loader2,
  Info
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { KineticButton } from '@/components/ui/KineticButton';
import { Badge } from '@/components/ui/badge';
import { DiscoveredPromoPage } from '@/hooks/use-discovered-promo-pages';
import { formatShopeePromoPageMessage, getCouponPrimaryUrl } from '@/lib/marketplaces/shopee/coupon-formatter';

interface DiscoveredPromoCardProps {
  page: DiscoveredPromoPage;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
  onReject?: (id: string) => void;
  onReaffiliate?: (id: string) => void;
}

export const DiscoveredPromoCard: React.FC<DiscoveredPromoCardProps> = ({ 
  page,
  isSelected = false,
  onToggleSelection,
  onReject,
  onReaffiliate
}) => {
  const router = useRouter();
  const [isEditing, setIsEditing] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState(page.title || '');
  const [currentTitle, setCurrentTitle] = React.useState(page.title || '');
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setCurrentTitle(page.title || '');
  }, [page.title]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      toast.error('O título do item não pode ser vazio.');
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/shopee/discovered-promo-pages/${page.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim() })
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao salvar alterações.');
      }
      
      setCurrentTitle(editTitle.trim());
      setIsEditing(false);
      toast.success('Nome da página promocional atualizado com sucesso!', {
        icon: <CheckCircle2 className="text-emerald-400" size={16} />
      });
    } catch (err: any) {
      console.error('[UI-EDIT-PROMO] Erro:', err);
      toast.error(err.message || 'Falha ao salvar. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const isReaffiliated = page.reaffiliation_status === 'reaffiliated';
  const hasWarning = page.reaffiliation_status === 'failed' || page.reaffiliation_status === 'blocked';
  
  const primaryLink = getCouponPrimaryUrl(page);
  const hasLink = !!primaryLink;

  const handleCopyMessage = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!primaryLink || primaryLink === 'undefined') {
      toast.error('Não é possível copiar: link de resgate ausente ou inválido.');
      return;
    }

    console.log('[PROMO-CARD-ACTION]', {
      action: 'copy',
      pageId: page.id,
      title: currentTitle,
      primaryUrl: primaryLink
    });

    const formattedMessage = formatShopeePromoPageMessage({
      title: currentTitle,
      affiliateUrl: primaryLink
    });

    if (!formattedMessage) {
      toast.error('Erro ao formatar mensagem. Verifique a integridade do link.');
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
      console.log('[PROMO-CARD-ACTION]', {
        action: 'open',
        pageId: page.id,
        title: currentTitle,
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

    console.log('[SHOPEE-PROMO-PAGE]', {
      action: 'quick_send',
      hasPrimaryUrl: true
    });

    const stored = {
      links: primaryLink,
      coupons: [],
      sourceType: 'shopee_promo_page',
      title: currentTitle,
      timestamp: Date.now()
    };
    
    localStorage.setItem('quick_send_draft', JSON.stringify(stored));
    toast.success('Página de oferta preparada para o Envio Rápido!');
    router.push('/envio-rapido');
  };

  const handleReaffiliate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReaffiliate?.(page.id);
  };

  const landingTypeConfig: Record<string, string> = {
    cashback: 'Cashback',
    pagina_cupons: 'Página de Cupons',
    oferta_relampago: 'Oferta Relâmpago',
    pagina_oferta: 'Página de Ofertas',
    super_ofertas: 'Super Ofertas'
  };
  const landingLabel = landingTypeConfig[page.landing_type] || page.landing_type?.charAt(0).toUpperCase() + page.landing_type?.slice(1) || 'Promoção';

  return (
    <div 
      className={cn(
        "group relative cursor-pointer",
        isSelected && "scale-[1.02] transition-transform"
      )}
      onClick={() => onToggleSelection?.(page.id)}
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
          id={`delete-promo-page-${page.id}`}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log(`[UI] Clicado em excluir página de promoção: ${page.id}`);
            onReject?.(page.id);
          }}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-xl bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 active:scale-95 transition-all flex items-center justify-center border border-red-500/20 shadow-skeuo-flat"
          title="Remover página permanentemente"
        >
          <Trash2Icon size={18} />
        </button>

        {/* Header Simplificado */}
        <div className="flex items-center justify-between mb-6 pl-6">
          <div className="flex flex-col gap-1.5">
            {!hasLink && (
              <Badge className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border-none bg-red-500/10 text-red-400">
                Link Inválido
              </Badge>
            )}
            {hasLink && isReaffiliated && (
              <Badge className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border-none flex items-center gap-1.5 w-fit shadow-sm bg-emerald-500/10 text-emerald-400">
                <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                Pronto para uso
              </Badge>
            )}
          </div>

          <Badge className="bg-white/5 text-white/40 border-white/10 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1.5">
            <Zap size={12} className="text-kinetic-orange" />
            {landingLabel}
          </Badge>
        </div>

        {/* Content Principal: Título */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[20px] font-black text-white/90 tracking-tighter leading-none italic uppercase">
                {landingLabel}
              </span>
              {page.capture_count > 1 && (
                <span className="text-[10px] text-white/20 font-black uppercase tracking-widest">
                  {page.capture_count}x visto
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <h4 className="text-[12px] font-bold text-white/70 uppercase tracking-wide leading-tight line-clamp-1">
                {currentTitle || 'Acesso VIP Shopee'}
              </h4>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditTitle(currentTitle);
                  setIsEditing(true);
                }}
                className="p-1 rounded bg-white/5 text-white/40 hover:text-kinetic-orange hover:bg-white/10 active:scale-95 transition-all"
                title="Editar nome da página"
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

      {/* Modal de Edição de Título */}
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
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-kinetic-orange to-transparent" />
            
            <h3 className="text-sm font-black uppercase tracking-wider text-white mb-4">
              Editar Nome da Página
            </h3>
            
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-white/40 mb-1.5">
                  Título / Nome da Página
                </label>
                <input 
                  type="text" 
                  value={editTitle} 
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  placeholder="Ex: Ofertas Relâmpago Shopee"
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
