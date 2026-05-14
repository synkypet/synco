import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Zap, 
  ExternalLink, 
  Copy, 
  Clock, 
  Activity, 
  ShieldAlert,
  Calendar,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DiscoveredPromoPage } from '@/hooks/use-discovered-promo-pages';

interface DiscoveredPromoCardProps {
  page: DiscoveredPromoPage;
}

export const DiscoveredPromoCard: React.FC<DiscoveredPromoCardProps> = ({ page }) => {
  const isReaffiliated = page.reaffiliation_status === 'reaffiliated';
  const hasWarning = page.reaffiliation_status === 'failed' || page.reaffiliation_status === 'blocked';
  
  const handleCopyMessage = () => {
    const url = page.effective_redemption_url || page.canonical_url || page.raw_url;
    
    const message = `🚨 *ACESSO VIP SHOPEE LIBERADO!* 🚨 

🔥 Uma página especial de ofertas da Shopee acabou de ser liberada com promoções por tempo limitado.

🛒 Produtos com descontos em várias categorias podem aparecer a qualquer momento.
🎟️ Cupons, frete grátis e ofertas relâmpago ficam disponíveis conforme estoque e disponibilidade.

⚡ Quem entra primeiro tem mais chance de aproveitar antes que os melhores achados acabem.

🔗 *ENTRE NA ÁREA VIP DE OFERTAS:*
${url}

⚠️ *Atenção:* Os preços, cupons e descontos podem mudar ou acabar sem aviso prévio.`;

    navigator.clipboard.writeText(message);
    toast.success('Mensagem copiada com link ' + (isReaffiliated ? 're-afiliado!' : 'original.'));
  };

  const handleOpenLink = () => {
    const url = page.effective_redemption_url || page.canonical_url || page.raw_url;
    if (url) window.open(url, '_blank');
  };

  return (
    <div className="bg-anthracite-surface rounded-[32px] p-5 shadow-skeuo-flat border border-white/[0.02] flex flex-col gap-5 group hover:shadow-skeuo-elevated transition-all duration-500 relative overflow-hidden">
      {/* Background Glow suave */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-kinetic-orange/5 rounded-full blur-[80px] group-hover:bg-kinetic-orange/10 transition-colors" />

      {/* Header Info */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Badge className="bg-kinetic-orange/10 text-kinetic-orange border-none text-[8px] font-black uppercase tracking-widest px-2 py-0.5">
              Página Promocional
            </Badge>
            <Badge className="bg-white/5 text-white/40 border-none text-[8px] font-black uppercase tracking-widest px-2 py-0.5">
              {page.landing_type === 'super_ofertas' ? 'Super Ofertas' : page.landing_type}
            </Badge>
          </div>
          <h4 className="text-sm font-black text-white/90 leading-tight line-clamp-2 mt-1">
            {page.title || 'Acesso VIP Shopee'}
          </h4>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center shadow-skeuo-pressed">
          <Zap size={18} className="text-kinetic-orange" />
        </div>
      </div>

      {/* Status & Re-affiliation Info */}
      <div className="space-y-3">
        {isReaffiliated ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-500/5 rounded-xl border border-green-500/10">
            <CheckCircle2 size={12} className="text-green-500" />
            <span className="text-[9px] font-bold text-green-500/80 uppercase tracking-widest">Link re-afiliado com sucesso</span>
          </div>
        ) : hasWarning ? (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-500/5 rounded-xl border border-red-500/10">
            <AlertTriangle size={12} className="text-red-500" />
            <span className="text-[9px] font-bold text-red-500/80 uppercase tracking-widest">
              {page.reaffiliation_status === 'blocked' ? 'Sem conexão Shopee' : 'Falha na re-afiliação'}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/[0.02]">
            <Activity size={12} className="text-white/20" />
            <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Link original capturado</span>
          </div>
        )}

        <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/5 rounded-xl border border-amber-500/10">
          <ShieldAlert size={12} className="text-amber-500" />
          <span className="text-[9px] font-bold text-amber-500/80 uppercase tracking-widest">Envio automático bloqueado</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-deep-void p-3 rounded-2xl shadow-skeuo-pressed flex flex-col gap-1">
          <span className="text-[8px] font-black text-white/20 uppercase tracking-widest flex items-center gap-1">
            <Activity size={8} /> Capturas
          </span>
          <span className="text-xs font-black text-white/90">{page.capture_count}x</span>
        </div>
        <div className="bg-deep-void p-3 rounded-2xl shadow-skeuo-pressed flex flex-col gap-1">
          <span className="text-[8px] font-black text-white/20 uppercase tracking-widest flex items-center gap-1">
            <Clock size={8} /> Visto em
          </span>
          <span className="text-[10px] font-bold text-white/60">
            {formatDistanceToNow(new Date(page.last_seen_at), { addSuffix: true, locale: ptBR })}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3 mt-auto pt-2">
        <Button 
          onClick={handleOpenLink}
          variant="ghost" 
          className="h-11 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-black text-[9px] uppercase tracking-widest gap-2 border border-white/[0.02]"
        >
          <ExternalLink size={14} /> Abrir
        </Button>
        <Button 
          onClick={handleCopyMessage}
          className="h-11 rounded-xl bg-kinetic-orange hover:bg-kinetic-orange/90 text-white font-black text-[9px] uppercase tracking-widest gap-2 shadow-glow-orange border-none"
        >
          <Copy size={14} /> Copiar
        </Button>
      </div>
    </div>
  );
};
