'use client';

import React, { useEffect, useState } from 'react';
import {
  Send,
  PackageCheck,
  AlertTriangle,
  Users,
  Zap,
  ShieldCheck,
  Star,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  LayoutDashboard,
  Megaphone,
} from 'lucide-react';
import LayoutContainer from '@/components/layout/LayoutContainer';
import PageHeader from '@/components/shared/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { TactileCard } from '@/components/ui/TactileCard';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalSent: number;
  totalErrors: number;
  totalPending: number;
  totalProducts: number;
  totalGroups: number;
  avgScore: number;
  recentCampaigns: {
    id: string;
    name: string;
    status: string;
    created_at: string;
    total_destinations: number;
  }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function CampaignStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    completed: { label: 'Concluído', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    sending: { label: 'Enviando', className: 'bg-kinetic-orange/10 text-kinetic-orange border-kinetic-orange/20' },
    pending: { label: 'Pendente', className: 'bg-white/5 text-white/40 border-white/10' },
    failed: { label: 'Erro', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
    cancelled: { label: 'Cancelado', className: 'bg-white/5 text-white/20 border-white/5' },
  };

  const { label, className } = config[status] || { label: status, className: 'bg-white/5 text-white/40' };

  return (
    <Badge variant="outline" className={cn('text-[8px] font-black uppercase tracking-widest border h-5 px-2', className)}>
      {label}
    </Badge>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function StatSkeleton() {
  return (
    <div className="h-[100px] rounded-2xl bg-anthracite-surface animate-pulse shadow-skeuo-flat" />
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const fetchStats = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/dashboard/stats', {
          headers: { 'x-user-id': user.id },
        });
        if (!res.ok) throw new Error('Falha ao carregar estatísticas');
        const data = await res.json();
        setStats(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [user?.id]);

  const kpiItems = stats ? [
    {
      label: 'Mensagens Enviadas',
      value: stats.totalSent.toLocaleString('pt-BR'),
      description: 'Disparos concluídos com sucesso',
      icon: <Send size={16} />,
      colorScheme: 'kinetic' as const,
    },
    {
      label: 'Erros de Envio',
      value: stats.totalErrors.toLocaleString('pt-BR'),
      description: 'Jobs com falha definitiva',
      icon: <AlertTriangle size={16} />,
      colorScheme: 'default' as const,
    },
    {
      label: 'Produtos no Radar',
      value: stats.totalProducts.toLocaleString('pt-BR'),
      description: 'Ofertas descobertas e mapeadas',
      icon: <PackageCheck size={16} />,
      colorScheme: 'default' as const,
    },
    {
      label: 'Grupos Sincronizados',
      value: stats.totalGroups.toLocaleString('pt-BR'),
      description: 'Destinos de broadcast ativos',
      icon: <Users size={16} />,
      colorScheme: 'success' as const,
    },
  ] : null;

  return (
    <LayoutContainer type="analytical">
      <PageHeader
        title="Dashboard"
        description="Visão geral do seu desempenho operacional e alcance de afiliados."
        icon={<LayoutDashboard size={24} />}
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
          : kpiItems?.map((item) => (
            <StatCard
              key={item.label}
              label={item.label}
              value={item.value}
              description={item.description}
              icon={item.icon}
              colorScheme={item.colorScheme}
            />
          ))}
      </div>

      {/* Área principal: Campanhas + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">

        {/* Últimas 20 Campanhas */}
        <div className="lg:col-span-7">
          <TactileCard className="p-6 border-none h-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-xl bg-kinetic-orange/10 flex items-center justify-center shadow-skeuo-flat border border-kinetic-orange/20">
                <Megaphone className="w-4 h-4 text-kinetic-orange" />
              </div>
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] font-headline italic text-white/90">
                  Últimas Campanhas
                </h3>
                <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                  Histórico de Broadcasts
                </p>
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-5" />

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 opacity-30 gap-2">
                <XCircle className="w-8 h-8 text-red-400" />
                <p className="text-[10px] font-black uppercase tracking-widest">Erro ao carregar dados</p>
              </div>
            ) : stats?.recentCampaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-20">
                <Megaphone className="w-8 h-8" />
                <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma campanha ainda</p>
                <p className="text-[9px] font-bold uppercase text-white/40">Use o Envio Rápido para começar</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                {stats?.recentCampaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex items-center justify-between p-4 rounded-2xl bg-deep-void shadow-skeuo-pressed gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-tight text-white/80 truncate">
                        {campaign.name}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[9px] text-white/20 font-bold uppercase">
                          {formatDate(campaign.created_at)}
                        </span>
                        {campaign.total_destinations > 0 && (
                          <span className="text-[9px] text-white/20 font-bold uppercase">
                            {campaign.total_destinations} destinos
                          </span>
                        )}
                      </div>
                    </div>
                    <CampaignStatusBadge status={campaign.status} />
                  </div>
                ))}
              </div>
            )}
          </TactileCard>
        </div>

        {/* Painel Lateral: Score + Status Operacional */}
        <div className="lg:col-span-5 space-y-6">

          {/* Score Médio */}
          <TactileCard className="p-6 border-none">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shadow-skeuo-flat border border-amber-500/20">
                <Star className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] font-headline italic text-white/90">
                  Score Médio do Radar
                </h3>
                <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                  Qualidade das ofertas descobertas
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="h-16 rounded-xl bg-white/5 animate-pulse" />
            ) : (
              <div className="flex items-end gap-3 px-2">
                <span className="text-5xl font-black text-kinetic-orange font-headline italic">
                  {stats?.avgScore ?? '—'}
                </span>
                <div className="mb-2 flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/20">/ 100</span>
                  <span className="text-[9px] font-bold text-white/10 uppercase">Opportunity Score</span>
                </div>
              </div>
            )}
          </TactileCard>

          {/* Fila Ativa */}
          <TactileCard className="p-6 border-none">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shadow-skeuo-flat border border-blue-500/20">
                <Clock className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] font-headline italic text-white/90">
                  Fila de Envio
                </h3>
                <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                  Jobs pendentes no worker
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="h-10 rounded-xl bg-white/5 animate-pulse" />
            ) : (
              <div className="flex items-center gap-3 px-2">
                <span className="text-4xl font-black text-white/80 font-headline italic">
                  {stats?.totalPending ?? 0}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/20 mt-1">
                  aguardando disparo
                </span>
              </div>
            )}
          </TactileCard>

          {/* Status Operacional */}
          <TactileCard className="p-6 border-none bg-gradient-to-br from-anthracite-surface to-deep-void">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-kinetic-orange/15 flex items-center justify-center border border-kinetic-orange/20">
                <Zap className="w-4 h-4 text-kinetic-orange" />
              </div>
              <div className="flex-1">
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] font-headline italic text-white/90">
                  Status Operacional M1
                </h3>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-full border border-white/5 shadow-skeuo-pressed">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span className="text-[9px] text-emerald-500 font-black uppercase tracking-widest">Online</span>
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-5" />

            <div className="space-y-3">
              {[
                { label: 'Autenticação Supabase & RLS', ok: true },
                { label: 'Processador de Links (Factual)', ok: true },
                { label: 'Engine de Broadcast (Worker)', ok: true },
                { label: 'Radar de Descoberta', ok: true },
              ].map(({ label, ok }) => (
                <div key={label} className="flex items-center gap-3 group">
                  <div className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center transition-all',
                    ok ? 'bg-emerald-500/10 text-emerald-500' : 'bg-white/5 text-white/10'
                  )}>
                    {ok ? <CheckCircle2 className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />}
                  </div>
                  <span className={cn(
                    'text-[11px] font-bold uppercase tracking-wider transition-colors',
                    ok ? 'text-white/60 group-hover:text-white' : 'text-white/20'
                  )}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </TactileCard>
        </div>
      </div>
    </LayoutContainer>
  );
}
