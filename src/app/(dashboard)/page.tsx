import type { Metadata } from 'next';
import {
  Send,
  PackageCheck,
  DollarSign,
  Star,
  TrendingUp,
  Zap,
  ShieldCheck,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Visão geral do seu desempenho de afiliado.',
};

// ─── KPI Config ──────────────────────────────────────────────────────────────

interface KpiItem {
  label: string;
  value: string;
  trend: string;
  trendUp: boolean;
  icon: React.ElementType;
  accent: 'orange' | 'neutral' | 'red';
}

const KPI_ITEMS: KpiItem[] = [
  {
    label: 'Mensagens Enviadas',
    value: '—',
    trend: 'Aguardando dados',
    trendUp: true,
    icon: Send,
    accent: 'orange',
  },
  {
    label: 'Produtos Ativos',
    value: '—',
    trend: 'Aguardando dados',
    trendUp: true,
    icon: PackageCheck,
    accent: 'neutral',
  },
  {
    label: 'Comissão do Mês',
    value: '—',
    trend: 'Aguardando dados',
    trendUp: true,
    icon: DollarSign,
    accent: 'neutral',
  },
  {
    label: 'Score Médio',
    value: '—',
    trend: 'Aguardando dados',
    trendUp: false,
    icon: Star,
    accent: 'neutral',
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ item }: { item: KpiItem }) {
  const Icon = item.icon;
  const isOrange = item.accent === 'orange';

  return (
    <div
      className={[
        // TactileCard base — No-Line, depth via shadow
        'bg-anthracite-surface rounded-2xl p-6 flex flex-col gap-4',
        'shadow-skeuo-elevated',
        'group transition-all duration-300 hover:shadow-[8px_8px_20px_#08080a,-8px_-8px_20px_#222228]',
      ].join(' ')}
    >
      {/* Header row */}
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">
          {item.label}
        </span>
        <div
          className={[
            'w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-300',
            isOrange
              ? 'bg-kinetic-orange/15 text-kinetic-orange group-hover:bg-kinetic-orange/25'
              : 'bg-white/5 text-white/30 group-hover:text-white/50',
          ].join(' ')}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>

      {/* Value — skeuo-pressed cavity, Space Grotesk */}
      <div className="bg-deep-void rounded-xl px-4 py-3 shadow-skeuo-pressed">
        <div
          className={[
            'font-headline text-4xl font-bold tabular-nums',
            isOrange
              ? 'text-kinetic-orange drop-shadow-[0_0_12px_rgba(255,107,0,0.4)]'
              : 'text-white/80',
          ].join(' ')}
        >
          {item.value}
        </div>
        <div
          className={[
            'text-[10px] mt-1 flex items-center gap-1 font-medium',
            isOrange ? 'text-kinetic-orange/60' : 'text-white/20',
          ].join(' ')}
        >
          <TrendingUp className="w-3 h-3" />
          {item.trend}
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">

      {/* Page header */}
      <div>
        <h1 className="font-headline text-2xl font-bold tracking-tight text-white">
          Dashboard
        </h1>
        <p className="text-white/30 text-sm mt-1 font-inter">
          Visão geral do seu desempenho
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPI_ITEMS.map((item) => (
          <KpiCard key={item.label} item={item} />
        ))}
      </div>

      {/* Status panel — TactileCard flat variant */}
      <div className="bg-anthracite-surface rounded-2xl p-6 shadow-skeuo-flat">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-kinetic-orange/15 flex items-center justify-center">
            <Zap className="w-4 h-4 text-kinetic-orange" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white/80 font-headline tracking-tight">
              Sistema Operacional
            </p>
            <p className="text-[10px] text-white/30 uppercase tracking-widest font-inter">
              Status atual
            </p>
          </div>
          {/* Live indicator */}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-kinetic-orange animate-pulse shadow-glow-orange" />
            <span className="text-[10px] text-kinetic-orange font-bold uppercase tracking-widest">
              Online
            </span>
          </div>
        </div>

        {/* Gradient separator — No-Line */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-4" />

        {/* Status items */}
        <div className="space-y-2">
          {[
            { label: 'Layout & Navegação', ok: true },
            { label: 'Sidebar, Topbar e design tokens', ok: true },
            { label: 'Autenticação Supabase', ok: true },
            { label: 'Conteúdo real das páginas (Fases 2–4)', ok: false },
          ].map(({ label, ok }) => (
            <div key={label} className="flex items-center gap-2.5">
              <ShieldCheck
                className={[
                  'w-3.5 h-3.5 flex-shrink-0',
                  ok ? 'text-emerald-500' : 'text-white/20',
                ].join(' ')}
              />
              <span
                className={[
                  'text-xs font-inter',
                  ok ? 'text-white/60' : 'text-white/20',
                ].join(' ')}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
