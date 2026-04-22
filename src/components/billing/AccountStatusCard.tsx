'use client';

import React from 'react';
import { useAccess } from '@/hooks/use-access';
import { StatusBadge } from './StatusBadge';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Shield, ChevronRight } from 'lucide-react';

interface AccountStatusCardProps {
  collapsed: boolean;
}

/**
 * AccountStatusCard - Card compacto para a Sidebar (Fase 3).
 * Exibe o resumo do plano e status de acesso.
 */
export function AccountStatusCard({ collapsed }: AccountStatusCardProps) {
  const { access, isLoading, planName, isOperative } = useAccess();

  if (isLoading) {
    return (
      <div className={cn("px-4 py-3 mx-2 mb-2 animate-pulse bg-white/5 rounded-2xl", collapsed && "px-0 mx-4")}>
        {!collapsed && <div className="h-3 w-16 bg-white/10 rounded mb-2" />}
        <div className={cn("h-4 bg-white/10 rounded-full", collapsed ? "w-4 h-4 mx-auto" : "w-24")} />
      </div>
    );
  }

  // Modo Colapsado: Apenas um indicador de saúde da conta (Glow Dot)
  if (collapsed) {
    return (
      <Link 
        href="/configuracoes?tab=billing"
        className="flex justify-center py-4 group relative"
      >
        <div 
          className={cn(
            "w-2.5 h-2.5 rounded-full transition-all duration-500",
            isOperative 
              ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" 
              : "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)] animate-pulse"
          )} 
        />
        {/* Tooltip */}
        <div className="absolute left-full ml-3 px-3 py-1.5 bg-anthracite-surface text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-skeuo-elevated opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
          {planName} — {isOperative ? 'Operativo' : 'Restrito'}
        </div>
      </Link>
    );
  }

  // Modo Expandido: Card Skeuomórfico
  return (
    <Link 
      href="/configuracoes?tab=billing"
      className="block px-3 py-3 mx-2 mb-4 rounded-2xl bg-anthracite-surface/40 hover:bg-anthracite-surface/60 transition-all border border-white/5 group shadow-skeuo-flat hover:shadow-skeuo-elevated"
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-white/40 truncate italic">
              {planName}
            </span>
            {access?.status === 'internal_license' && (
              <Shield className="w-2.5 h-2.5 text-cyan-400 opacity-50 flex-shrink-0" />
            )}
          </div>
          <ChevronRight className="w-3 h-3 text-white/10 group-hover:text-kinetic-orange transition-colors" />
        </div>
        
        <StatusBadge status={access?.status} className="w-fit" />
      </div>
    </Link>
  );
}
