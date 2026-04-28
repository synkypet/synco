'use client';

import React from 'react';
import { useAccess } from '@/hooks/use-access';
import { AlertCircle, Lock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

/**
 * OperationalAccessBanner - Banner contextual para páginas operacionais.
 * Exibido apenas quando o usuário está em estado não operativo.
 */
export function OperationalAccessBanner() {
  const { access, isOperative, isLoading } = useAccess();

  if (isLoading || isOperative || !access) return null;

  const status = access.status;
  const config = getBannerConfig(status);
  const Icon = config.icon;

  return (
    <div className="w-full mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className={cn(
        "relative overflow-hidden rounded-2xl border p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-skeuo-flat",
        config.bgColor,
        config.borderColor
      )}>
        {/* Background Glow */}
        <div className={cn("absolute -top-12 -left-12 w-32 h-32 blur-[60px] rounded-full opacity-20", config.glowColor)} />

        <div className="flex items-center gap-4 relative z-10">
          <div className={cn(
            "p-2.5 rounded-xl border shadow-skeuo-pressed flex-shrink-0",
            config.iconBg,
            config.iconBorder
          )}>
            <Icon className={cn("w-5 h-5", config.iconColor)} />
          </div>
          
          <div className="space-y-1 text-center md:text-left">
            <h4 className={cn("text-[10px] font-black uppercase tracking-[0.2em] italic", config.textColor)}>
              {config.title}
            </h4>
            <p className="text-xs font-medium text-white/70 max-w-2xl leading-relaxed">
              {getMessageForBanner(status)}
            </p>
          </div>
        </div>

        <Link href={status === 'no_subscription' ? "/billing/plans" : "/billing"} className="relative z-10 w-full md:w-auto">
          <Button 
            variant="outline" 
            className={cn(
              "w-full md:w-auto h-10 px-6 text-[10px] font-black uppercase tracking-widest transition-all",
              status === 'no_subscription' 
                ? "bg-kinetic-orange text-white border-none shadow-glow-orange hover:bg-orange-600" 
                : "border-white/10 hover:bg-white/5 bg-transparent text-white/60 hover:text-white"
            )}
          >
            {status === 'no_subscription' ? 'Assinar Plano Agora' : 'Ver detalhes do plano'}
            <ChevronRight className="w-3 h-3 ml-2 opacity-50" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function getMessageForBanner(status: string) {
  switch (status) {
    case 'past_due_restricted':
      return 'Seu acesso está com pagamento pendente. Você ainda pode navegar pelo sistema, mas não pode criar ou disparar campanhas no momento.';
    case 'expired_blocked':
      return 'Sua assinatura expirou. Reative seu acesso para voltar a operar no SYNCO.';
    case 'no_subscription':
    default:
      return 'Sua conta ainda não possui um plano ativo. Escolha um plano para começar a operar.';
  }
}

function getBannerConfig(status: string) {
  switch (status) {
    case 'past_due_restricted':
      return {
        title: 'Acesso Restrito',
        icon: AlertCircle,
        bgColor: 'bg-amber-500/[0.03]',
        borderColor: 'border-amber-500/10',
        glowColor: 'bg-amber-500',
        iconBg: 'bg-amber-500/5',
        iconBorder: 'border-amber-500/10',
        iconColor: 'text-amber-400',
        textColor: 'text-amber-400/80'
      };
    case 'expired_blocked':
    case 'no_subscription':
    default:
      return {
        title: 'Operação Bloqueada',
        icon: Lock,
        bgColor: 'bg-rose-500/[0.03]',
        borderColor: 'border-rose-500/10',
        glowColor: 'bg-rose-500',
        iconBg: 'bg-rose-500/5',
        iconBorder: 'border-rose-500/10',
        iconColor: 'text-rose-400',
        textColor: 'text-rose-400/80'
      };
  }
}
