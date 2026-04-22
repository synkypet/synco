import React from 'react';
import { useAccess } from '@/hooks/use-access';
import { Card } from '@/components/ui/card';
import { StatusBadge } from './StatusBadge';
import { CheckCircle2, XCircle, Zap, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * PlanDetailsCard - Painel detalhado de assinatura para a tela de Configurações.
 */
export function PlanDetailsCard() {
  const { access, planName, quotas, features, isInternal } = useAccess();

  if (!access) return null;

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* Header: Plano e Status */}
      <Card className="p-8 border-none ring-1 ring-white/5 bg-gradient-to-br from-anthracite-surface to-deep-void shadow-skeuo-elevated overflow-hidden relative">
        {/* Efeito de Glow de fundo para o header */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-kinetic-orange/5 blur-[100px] rounded-full" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 italic">Assinatura Operacional</p>
            <h2 className="text-3xl font-black uppercase tracking-tight font-headline italic text-white flex items-center gap-3">
              {planName}
              {isInternal && <Shield className="w-6 h-6 text-indigo-400/80 drop-shadow-[0_0_8px_rgba(129,140,248,0.3)]" />}
            </h2>
          </div>
          <StatusBadge status={access.status} className="h-10 px-6 text-xs shadow-skeuo-flat" />
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Quotas */}
        <Card className="p-6 border-none ring-1 ring-white/5 bg-anthracite-surface/50 shadow-skeuo-flat">
           <h3 className="text-xs font-black uppercase tracking-widest text-white/60 mb-8 flex items-center gap-2 italic">
             <Zap className="w-4 h-4 text-kinetic-orange" /> Capacidade & Limites
           </h3>
           <div className="space-y-6">
              <QuotaItem label="Canais de Saída" value={quotas?.max_channels} />
              <QuotaItem label="Grupos Sincronizados" value={quotas?.max_groups_sync} />
              <QuotaItem label="Envios Mensais" value={quotas?.max_sends_per_month} />
           </div>
        </Card>

        {/* Features */}
        <Card className="p-6 border-none ring-1 ring-white/5 bg-anthracite-surface/50 shadow-skeuo-flat">
           <h3 className="text-xs font-black uppercase tracking-widest text-white/60 mb-8 flex items-center gap-2 italic">
             <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Recursos do Sistema
           </h3>
           <div className="grid grid-cols-1 gap-3">
              <FeatureItem label="Radar de Ofertas" active={features?.radar_access} />
              <FeatureItem label="Acesso via API Operacional" active={features?.api_access} />
              <FeatureItem label="Relatórios Avançados" active={features?.advanced_reports} />
              <FeatureItem label="Assistente IA (M1 Core)" active={true} />
           </div>
        </Card>
      </div>

      {/* Mensagem de Contexto Skeuomórfica */}
      <div className="p-6 rounded-2xl bg-black/40 border border-white/5 shadow-skeuo-pressed text-center">
         <p className="text-[11px] text-white/30 uppercase font-black tracking-widest leading-relaxed max-w-2xl mx-auto italic">
            {getMessageForStatus(access.status)}
         </p>
      </div>
    </div>
  );
}

/**
 * Item de Quota com formatação skeuo
 */
function QuotaItem({ label, value }: { label: string, value?: number }) {
    const displayValue = value === 999 || value === 9999 || value === 9999999 ? 'Ilimitado' : value;
    return (
        <div className="flex items-center justify-between group">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/30 group-hover:text-white/50 transition-colors">
              {label}
            </span>
            <div className="flex items-center gap-3">
              <div className="h-px w-8 bg-white/5 group-hover:w-12 transition-all duration-500" />
              <span className="text-xs font-black uppercase tracking-[0.2em] text-white/80 font-mono">
                {displayValue}
              </span>
            </div>
        </div>
    );
}

/**
 * Item de Feature com indicador visual
 */
function FeatureItem({ label, active }: { label: string, active?: boolean }) {
    return (
        <div className={cn(
          "flex items-center justify-between p-3.5 rounded-xl transition-all duration-300 border",
          active 
            ? "bg-white/[0.02] border-white/5 hover:bg-white/[0.05]" 
            : "bg-transparent border-transparent opacity-30 grayscale"
        )}>
            <span className="text-[10px] font-black uppercase tracking-widest text-white/70">
                {label}
            </span>
            {active ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shadow-glow-emerald" />
            ) : (
                <XCircle className="w-3.5 h-3.5 text-white/20" />
            )}
        </div>
    );
}

/**
 * Traduções contextuais para o rodapé do billing
 */
function getMessageForStatus(status: string) {
    switch (status) {
        case 'internal_license': return 'Você está operando sob uma licença interna administrativa. Todos os recursos e limites estão em modo M1 de acesso total.';
        case 'active_subscription': return 'Sua assinatura está ativa e em conformidade. O motor factual está operando com capacidade total de processamento.';
        case 'trial': return 'Conta em período de demonstração. Explore as ferramentas de automação e radar para validar sua operação.';
        case 'past_due_restricted': return 'Seu acesso está com pagamento pendente. Você ainda pode navegar pelo sistema, mas não pode criar ou disparar campanhas no momento.';
        case 'expired_blocked': return 'Sua assinatura expirou. Reative seu acesso para voltar a operar no SYNCO.';
        default: return 'Sua conta ainda não possui um plano ativo. Escolha um plano para começar a operar.';
    }
}
