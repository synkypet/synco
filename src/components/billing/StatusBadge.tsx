import React from 'react';
import { cn } from '@/lib/utils';
import { Shield, CheckCircle2, AlertCircle, Clock, Lock, Sparkles } from 'lucide-react';
import { AccessStatus } from '@/types/billing';

interface StatusBadgeProps {
  status?: AccessStatus;
  className?: string;
  showIcon?: boolean;
}

/**
 * StatusBadge - Componente tátil para exibição de estados de billing.
 * Segue a estética Modern Skeuo / Kinetic Command Center.
 */
export function StatusBadge({ status, className, showIcon = true }: StatusBadgeProps) {
  if (!status) return null;

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <div 
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border transition-all duration-300",
        config.bgColor,
        config.borderColor,
        config.textColor,
        config.shadowColor,
        className
      )}
    >
      {showIcon && <Icon className={cn("w-2.5 h-2.5", config.iconColor)} />}
      <span className="italic">{config.label}</span>
      
      {/* Micro-glow pulse for critical states */}
      {(status === 'past_due_restricted' || status === 'expired_blocked') && (
        <span className="relative flex h-1.5 w-1.5 ml-0.5">
          <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", config.pingColor)}></span>
          <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", config.pingColor)}></span>
        </span>
      )}
    </div>
  );
}

function getStatusConfig(status: AccessStatus) {
  switch (status) {
    case 'internal_license':
      return {
        label: 'Licença Interna',
        icon: Shield,
        bgColor: 'bg-indigo-500/10',
        borderColor: 'border-indigo-500/20',
        textColor: 'text-indigo-300',
        iconColor: 'text-indigo-300',
        shadowColor: 'shadow-[0_0_12px_rgba(99,102,241,0.1)]',
        pingColor: ''
      };
    case 'active':
      return {
        label: 'Assinatura Ativa',
        icon: CheckCircle2,
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/20',
        textColor: 'text-emerald-400',
        iconColor: 'text-emerald-400',
        shadowColor: 'shadow-[0_0_12px_rgba(16,185,129,0.15)]',
        pingColor: ''
      };
    case 'trialing':
      return {
        label: 'Período de Teste',
        icon: Sparkles,
        bgColor: 'bg-purple-500/10',
        borderColor: 'border-purple-500/20',
        textColor: 'text-purple-400',
        iconColor: 'text-purple-400',
        shadowColor: 'shadow-[0_0_12px_rgba(168,85,247,0.15)]',
        pingColor: ''
      };
    case 'past_due':
      return {
        label: 'Em Atraso (Tolerância)',
        icon: AlertCircle,
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/20',
        textColor: 'text-amber-400',
        iconColor: 'text-amber-400',
        shadowColor: 'shadow-[0_0_8px_rgba(245,158,11,0.1)]',
        pingColor: ''
      };
    case 'canceled':
      return {
        label: 'Cancelada',
        icon: Lock,
        bgColor: 'bg-zinc-500/10',
        borderColor: 'border-zinc-500/20',
        textColor: 'text-zinc-400',
        iconColor: 'text-zinc-400',
        shadowColor: 'shadow-skeuo-pressed',
        pingColor: ''
      };
    case 'past_due_restricted':
      return {
        label: 'Pagamento Pendente',
        icon: AlertCircle,
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/20',
        textColor: 'text-amber-400',
        iconColor: 'text-amber-400',
        shadowColor: 'shadow-[0_0_8px_rgba(245,158,11,0.1)]',
        pingColor: 'bg-amber-500/50'
      };
    case 'expired_blocked':
      return {
        label: 'Assinatura Expirada',
        icon: Lock,
        bgColor: 'bg-rose-500/10',
        borderColor: 'border-rose-500/20',
        textColor: 'text-rose-400',
        iconColor: 'text-rose-400',
        shadowColor: 'shadow-[0_0_12px_rgba(244,63,94,0.15)]',
        pingColor: 'bg-rose-500'
      };
    case 'none':
      return {
        label: 'Sem Assinatura',
        icon: Lock,
        bgColor: 'bg-white/[0.03]',
        borderColor: 'border-white/10',
        textColor: 'text-white/40',
        iconColor: 'text-white/30',
        shadowColor: 'shadow-skeuo-pressed',
        pingColor: ''
      };
    default:
      return {
        label: 'Desconhecido',
        icon: Clock,
        bgColor: 'bg-white/5',
        borderColor: 'border-white/10',
        textColor: 'text-white/20',
        iconColor: 'text-white/20',
        shadowColor: '',
        pingColor: ''
      };
  }
}
