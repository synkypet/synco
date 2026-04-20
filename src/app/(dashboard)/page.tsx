'use client';

import React from 'react';
import {
  Send,
  AlertCircle,
  CheckCircle2,
  Users,
  Zap,
  LayoutDashboard,
  Calendar,
  TrendingUp,
  Package,
  ArrowRight,
  TrendingDown,
  Clock,
  Loader2,
  LayoutList
} from 'lucide-react';
import LayoutContainer from '@/components/layout/LayoutContainer';
import PageHeader from '@/components/shared/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { TactileCard } from '@/components/ui/TactileCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  useOperationalSummary, 
  usePerformanceCharts, 
  useOperationalHistory 
} from '@/hooks/use-reports';
import { useProducts } from '@/hooks/use-products';
import { useEarningsSummary } from '@/hooks/use-earnings';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import Link from 'next/link';

// ─── Dashboard ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: summary, isLoading: isLoadingSummary } = useOperationalSummary();
  const { data: charts, isLoading: isLoadingCharts } = usePerformanceCharts();
  const { data: history, isLoading: isLoadingHistory } = useOperationalHistory('week', 20);
  const { data: productsData, isLoading: isLoadingProducts } = useProducts({ sortBy: 'commission_percent', sortOrder: 'desc' });
  const { data: earnings } = useEarningsSummary();

  const isLoading = isLoadingSummary || isLoadingCharts || isLoadingHistory || isLoadingProducts;

  if (isLoading) {
    return (
      <LayoutContainer type="analytical">
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4 opacity-20">
          <Loader2 className="w-10 h-10 animate-spin text-kinetic-orange" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] font-headline italic">Sincronizando Dashboard...</span>
        </div>
      </LayoutContainer>
    );
  }

  // 4 KPIs Operacionais Prioritários
  const KPI_GRID = [
    {
      label: 'Tentativas de Envio',
      value: (summary?.total_sent || 0) + (summary?.total_failed || 0),
      description: 'Total de disparos processados',
      icon: <Send size={16} />,
      colorScheme: 'default' as const,
    },
    {
      label: 'Envios Concluídos',
      value: summary?.total_sent || 0,
      description: 'Sucesso absoluto na entrega',
      trend: { value: summary?.total_sent ? 'OK' : '0%', positive: true },
      icon: <CheckCircle2 size={16} />,
      colorScheme: 'success' as const,
    },
    {
      label: 'Falhas de Disparo',
      value: summary?.total_failed || 0,
      description: 'Erros de rede ou sessão',
      trend: summary?.total_failed ? { value: 'Atenção', positive: false } : undefined,
      icon: <AlertCircle size={16} />,
      colorScheme: 'destructive' as const,
    },
    {
      label: 'Grupos Conectados',
      value: summary?.total_groups || 0,
      description: 'Base total de audiência',
      icon: <Users size={16} />,
      colorScheme: 'kinetic' as const,
    },
  ];

  const topProducts = productsData?.slice(0, 5) || [];

  return (
    <LayoutContainer type="analytical">
      {/* Page header */}
      <PageHeader 
        title="Dashboard Operacional" 
        description="Monitoramento centralizado de envios, infraestrutura e performance de afiliados."
        icon={<LayoutDashboard size={24} />}
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {KPI_GRID.map((item) => (
          <StatCard 
            key={item.label}
            label={item.label}
            value={item.value.toLocaleString()}
            description={item.description}
            trend={item.trend}
            icon={item.icon}
            colorScheme={item.colorScheme}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Column (2/3) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Charts Section */}
          <TactileCard className="p-8 border-none bg-anthracite-surface/40 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-kinetic-orange/10 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-kinetic-orange" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-white/90">Performance Semanal</h3>
                  <p className="text-[9px] text-white/20 uppercase tracking-widest">Ritmo de envios por dia</p>
                </div>
              </div>
              {/* Secondary Metric - Quick View */}
              {summary && summary.estimated_reach > 0 && (
                <div className="text-right">
                  <span className="block text-[8px] font-black text-white/20 uppercase tracking-widest mb-0.5">Alcance Total</span>
                  <span className="text-sm font-black text-white">~{summary.estimated_reach.toLocaleString()} <span className="text-[10px] text-white/30">Membros</span></span>
                </div>
              )}
            </div>

            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts?.weekly}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF6B00" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#FF6B00" stopOpacity={0.3}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-white/5" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10, fontWeight: 900 }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <YAxis 
                    tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10, fontWeight: 900 }} 
                    axisLine={false} 
                    tickLine={false} 
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ 
                      backgroundColor: '#1A1A1E', 
                      border: '1px solid rgba(255,255,255,0.05)', 
                      borderRadius: '12px', 
                      fontSize: '10px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      letterSpacing: '1px'
                    }} 
                  />
                  <Bar dataKey="enviados" name="Sucesso" fill="url(#barGradient)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="falhas" name="Falhas" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TactileCard>

          {/* Recent History Section */}
          <TactileCard className="p-0 border-none bg-anthracite-surface/40 overflow-hidden">
            <div className="p-8 pb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-white/90">Histórico Recente</h3>
                  <p className="text-[9px] text-white/20 uppercase tracking-widest">Últimas 20 atividades registradas</p>
                </div>
              </div>
              <Link href="/relatorios">
                <Button variant="ghost" size="sm" className="h-8 text-[8px] font-black uppercase tracking-widest gap-2 bg-white/5 border-none">
                  Ver Tudo <ArrowRight size={10} />
                </Button>
              </Link>
            </div>

            <div className="divide-y divide-white/5">
              {history?.slice(0, 20).map((item, i) => (
                <div key={i} className="flex items-center gap-6 px-8 py-4 hover:bg-white/5 transition-colors group">
                  <div className="w-16 shrink-0 text-[10px] font-bold text-white/10 uppercase tracking-tighter group-hover:text-white/30 transition-colors">
                    {item.date}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black uppercase text-white/60 group-hover:text-white transition-colors truncate">
                      {item.event}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                       <span className="block text-[10px] font-black text-kinetic-orange leading-none">{item.envios}</span>
                       <span className="text-[8px] font-bold text-white/10 uppercase tracking-widest">Envios</span>
                    </div>
                    <ArrowRight size={12} className="text-white/5 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                  </div>
                </div>
              ))}
              {(!history || history.length === 0) && (
                <div className="p-12 text-center">
                  <Package className="w-10 h-10 text-white/5 mx-auto mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/20">Sem atividades recentes</p>
                </div>
              )}
            </div>
          </TactileCard>
        </div>

        {/* Right Column (1/3) */}
        <div className="space-y-8">
          
          {/* Top Products (Radar) */}
          <TactileCard className="p-8 border-none bg-anthracite-surface/40 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-white/90">Curadoria Elite</h3>
                <p className="text-[9px] text-white/20 uppercase tracking-widest">Comissão Top Radar</p>
              </div>
            </div>

            <div className="space-y-4">
              {topProducts.map((p) => (
                <div key={p.id} className="flex items-center gap-4 p-3 rounded-2xl bg-black/20 border border-white/5 hover:border-white/10 transition-colors group">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/40 border border-white/5 shrink-0">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={16} className="text-white/10" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[10px] font-black uppercase text-white/70 group-hover:text-white transition-colors truncate">{p.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="h-4 text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border-none">
                        {p.commission_percent}% Com.
                      </Badge>
                      <span className="text-[8px] font-bold text-white/10 uppercase">{p.marketplace}</span>
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-white/10" />
                </div>
              ))}
              {topProducts.length === 0 && (
                 <div className="py-12 text-center opacity-20">
                    <Package size={32} className="mx-auto mb-2" />
                    <span className="text-[9px] font-bold uppercase">Radar Vazio</span>
                 </div>
              )}
            </div>

            <Link href="/radar-ofertas" className="block mt-6">
              <Button variant="ghost" className="w-full h-10 text-[9px] font-black uppercase tracking-widest gap-2 bg-white/5 border-none hover:bg-kinetic-orange/10 hover:text-kinetic-orange group">
                Explorar Radar completO
                <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </TactileCard>

          {/* Efficiency KPI (replaced Commission main KPI with context) */}
          {earnings && (
            <TactileCard className="p-8 border-none bg-gradient-to-br from-indigo-500/5 to-transparent">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400">Contexto Ganhos</h3>
                  <p className="text-[9px] text-white/20 uppercase tracking-widest">Base de faturamento mensal</p>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-black text-white">{earnings.total_commissions.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                <span className="text-[10px] font-bold text-emerald-500/60 uppercase mb-1.5 flex items-center gap-1">
                  <TrendingUp size={10} /> Crescimento
                </span>
              </div>
              <div className="h-px bg-white/5 my-6" />
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <span className="block text-[8px] font-black text-white/20 uppercase tracking-[0.2em] mb-1">Pedidos</span>
                    <span className="text-xs font-black text-white/80">{earnings.total_orders}</span>
                 </div>
                 <div>
                    <span className="block text-[8px] font-black text-white/20 uppercase tracking-[0.2em] mb-1">Projeção</span>
                    <span className="text-xs font-black text-white/80">R$ 4.2k</span>
                 </div>
              </div>
            </TactileCard>
          )}

          {/* Activity Heatmap (Hourly) */}
          <TactileCard className="p-8 border-none bg-anthracite-surface/40 backdrop-blur-sm">
             <div className="flex flex-col gap-1 mb-8">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40">Distribuição de Tráfego</h3>
                <span className="text-[8px] font-bold text-white/10 uppercase tracking-widest">Atividade horária do motor</span>
             </div>
             
             <div className="h-[120px] w-full opacity-50">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts?.hourly}>
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="enviados" stroke="#4f46e5" strokeWidth={2} fill="url(#areaGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
             </div>
             
             <div className="flex items-center justify-between mt-6">
                <span className="text-[8px] font-black text-white/10 uppercase tracking-widest">Pico Operacional</span>
                <Badge className="h-4 text-[8px] font-black bg-white/5 border-none text-white/40">14:00 - 16:00</Badge>
             </div>
          </TactileCard>

        </div>
      </div>
    </LayoutContainer>
  );
}

