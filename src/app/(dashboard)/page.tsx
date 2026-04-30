'use client';

import React, { useState } from 'react';
import {
  Send,
  AlertCircle,
  CheckCircle2,
  Users,
  Zap,
  LayoutDashboard,
  Calendar as CalendarIcon,
  TrendingUp,
  Package,
  ArrowRight,
  TrendingDown,
  Clock,
  Loader2,
  LayoutList,
  Search
} from 'lucide-react';
import { ptBR } from 'date-fns/locale';
import { formatDistanceToNow, format as formatDate, parseISO, startOfDay, endOfDay } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import LayoutContainer from '@/components/layout/LayoutContainer';
import PageHeader from '@/components/shared/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { TactileCard } from '@/components/ui/TactileCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as DashboardCalendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  useOperationalSummary, 
  usePerformanceCharts, 
  useUnifiedActivity
} from '@/hooks/use-reports';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ─── Dashboard ──────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('week');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filterOptions = { period, startDate, endDate };

  const { data: summary, isLoading: isLoadingSummary } = useOperationalSummary(user?.id, filterOptions);
  const { data: charts, isLoading: isLoadingCharts } = usePerformanceCharts(user?.id, filterOptions);
  const { data: history, isLoading: isLoadingHistory } = useUnifiedActivity(user?.id, filterOptions, 10);
  
  // ─── Loading State Logic (Smart partial refresh) ──────────────────────────
  const isInitialLoading = 
    (isLoadingSummary && !summary) || 
    (isLoadingCharts && !charts) ||
    (!user); // Garante que o contexto de auth esteja pronto

  if (isInitialLoading) {
    return (
      <LayoutContainer type="analytical">
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-kinetic-orange" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] font-headline italic">Sincronizando Dashboard...</span>
        </div>
      </LayoutContainer>
    );
  }

  // Trio Executivo Hero
  // Hero Command Center Metrics
  const HERO_KPIs = [
    {
      label: 'Campanhas Ativas',
      value: summary?.active_campaigns_count || 0,
      description: 'Estruturas de disparo',
      icon: <Send />,
      colorScheme: 'kinetic' as const,
      href: '/campanhas',
    },
    {
      label: 'Monitoramentos',
      value: summary?.monitorings_count || 0,
      description: 'Fontes de entrada',
      icon: <Users />,
      colorScheme: 'kinetic' as const,
      href: '/monitoramento',
    },
    {
      label: 'Automações Ativas',
      value: summary?.active_automations_count || 0,
      description: 'Pipelines em execução',
      icon: <Zap />,
      colorScheme: 'kinetic' as const,
      href: '/automacoes',
    },
    {
      label: 'Grupos Conectados',
      value: summary?.total_groups || 0,
      description: 'Conexões operacionais',
      icon: <Users />,
      colorScheme: 'kinetic' as const,
      href: '/grupos',
    },
    {
      label: 'Listas de Destino',
      value: summary?.destination_lists_count || 0,
      description: 'Segmentações ativa',
      icon: <LayoutList />,
      colorScheme: 'kinetic' as const,
      href: '/listas-destino',
    },
  ];

  const totalAttempts = (summary?.total_sent || 0) + (summary?.total_failed || 0);

  // Calcular proporções para o Comparativo
  const successRate = totalAttempts > 0 ? (summary!.total_sent / totalAttempts) * 100 : 0;
  const failureRate = totalAttempts > 0 ? (summary!.total_failed / totalAttempts) * 100 : 0;

  return (
    <LayoutContainer type="analytical">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <PageHeader 
          title="Dashboard Operacional" 
          description="Monitoramento centralizado de envios e performance."
          icon={<LayoutDashboard size={24} />}
          className="mb-0"
        />
        
        <div className="flex flex-wrap items-center gap-3">
            {/* O filtro foi movido para a seção de Comparativo de Envios abaixo */}
        </div>
      </div>

      {/* Command Bar / Ações Rápidas (Mais discreta) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Link href="/envio-rapido" className="block">
          <TactileCard className="p-3 flex items-center gap-3 hover:shadow-glow-orange/10 transition-all group cursor-pointer border-none bg-anthracite-surface/30 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-lg bg-kinetic-orange/5 flex items-center justify-center group-hover:bg-kinetic-orange/10 transition-all">
              <Zap className="w-4 h-4 text-kinetic-orange/60" />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/70">Envio Rápido</span>
            </div>
          </TactileCard>
        </Link>
        <Link href="/canais" className="block">
          <TactileCard className="p-3 flex items-center gap-3 hover:shadow-glow-orange/10 transition-all group cursor-pointer border-none bg-anthracite-surface/30 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-lg bg-blue-500/5 flex items-center justify-center group-hover:bg-blue-500/10 transition-all">
              <Users className="w-4 h-4 text-blue-400/60" />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/70">Canais & Grupos</span>
            </div>
          </TactileCard>
        </Link>
        <Link href="/radar-ofertas" className="block">
          <TactileCard className="p-3 flex items-center gap-3 hover:shadow-glow-orange/10 transition-all group cursor-pointer border-none bg-anthracite-surface/30 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/5 flex items-center justify-center group-hover:bg-emerald-500/10 transition-all">
              <TrendingUp className="w-4 h-4 text-emerald-400/60" />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/70">Radar</span>
            </div>
          </TactileCard>
        </Link>
        <Link href="/monitoramento" className="block">
          <TactileCard className="p-3 flex items-center gap-3 hover:shadow-glow-orange/10 transition-all group cursor-pointer border-none bg-anthracite-surface/30 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/5 flex items-center justify-center group-hover:bg-indigo-500/10 transition-all">
              <LayoutDashboard className="w-4 h-4 text-indigo-400/60" />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/70">Monitoramento</span>
            </div>
          </TactileCard>
        </Link>
      </div>

      {/* Hub Executivo de Comando */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {HERO_KPIs.map((item) => (
          <StatCard 
            key={item.label}
            variant="premium"
            label={item.label}
            value={item.value}
            description={item.description}
            icon={item.icon}
            colorScheme={item.colorScheme}
            href={item.href}
            className={cn("p-6", isLoadingSummary && "opacity-80 transition-opacity")}
          />
        ))}
      </div>

      {/* Grid Principal: 2/3 (Operação) + 1/3 (Inteligência/Feed) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA ESQUERDA (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. Comparativo de Envios (Compacto) */}
          <TactileCard className={cn(
            "p-6 border-none bg-gradient-to-r from-anthracite-surface/60 to-anthracite-surface/20 relative overflow-hidden transition-all duration-500",
            isLoadingSummary && "before:absolute before:inset-0 before:bg-kinetic-orange/5 before:animate-pulse z-0"
          )}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-lg bg-kinetic-orange/20 flex items-center justify-center transition-all",
                      isLoadingSummary && "animate-spin"
                    )}>
                        <TrendingUp className="w-4 h-4 text-kinetic-orange" />
                    </div>
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-white/90">Comparativo de Envios</h3>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                    {/* Filtro Móvel (Docked ao Card) */}
                    <div className="flex items-center gap-2">
                        {period === 'custom' && (
                            <div className="flex items-center gap-2 mr-2">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button className="h-7 px-3 text-[9px] font-black uppercase bg-black/20 border border-white/5 rounded text-white/60 hover:bg-white/5 transition-colors flex items-center gap-2">
                                      <CalendarIcon size={10} className="text-kinetic-orange" />
                                      {startDate ? formatDate(parseISO(startDate), 'dd/MM/yyyy') : 'INÍCIO'}
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0 border-white/5" align="start">
                                    <DashboardCalendar
                                      mode="single"
                                      selected={startDate ? parseISO(startDate) : undefined}
                                      onSelect={(date: any) => setStartDate(date ? formatDate(date, 'yyyy-MM-dd') : '')}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>

                                <span className="text-[8px] font-black text-white/20">ATÉ</span>

                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button className="h-7 px-3 text-[9px] font-black uppercase bg-black/20 border border-white/5 rounded text-white/60 hover:bg-white/5 transition-colors flex items-center gap-2">
                                      <CalendarIcon size={10} className="text-kinetic-orange" />
                                      {endDate ? formatDate(parseISO(endDate), 'dd/MM/yyyy') : 'FIM'}
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0 border-white/5" align="start">
                                    <DashboardCalendar
                                      mode="single"
                                      selected={endDate ? parseISO(endDate) : undefined}
                                      onSelect={(date: any) => setEndDate(date ? formatDate(date, 'yyyy-MM-dd') : '')}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                            </div>
                        )}
                        <Select value={period} onValueChange={(val) => {
                          setPeriod(val);
                          if (val !== 'custom') {
                            setStartDate('');
                            setEndDate('');
                          }
                        }}>
                            <SelectTrigger className="w-[140px] h-7 text-[9px] font-black uppercase tracking-widest bg-white/5 border-none hover:bg-white/10 transition-colors">
                                <div className="flex items-center gap-2">
                                    <CalendarIcon size={10} className="text-kinetic-orange" />
                                    <SelectValue placeholder="Período" />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="bg-anthracite-surface border-white/5">
                                <SelectItem value="today" className="text-[9px] font-black uppercase">Hoje</SelectItem>
                                <SelectItem value="week" className="text-[9px] font-black uppercase">Últimos 7 dias</SelectItem>
                                <SelectItem value="15d" className="text-[9px] font-black uppercase">Últimos 15 dias</SelectItem>
                                <SelectItem value="30d" className="text-[9px] font-black uppercase">Últimos 30 dias</SelectItem>
                                <SelectItem value="custom" className="text-[9px] font-black uppercase">Personalizado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-6 border-l border-white/5 pl-4">
                        <div className="text-right">
                            <span className="block text-[8px] font-black text-white/20 uppercase tracking-widest">Sucesso</span>
                            <span className="text-sm font-black text-emerald-400">{successRate.toFixed(1)}%</span>
                        </div>
                        <div className="text-right">
                            <span className="block text-[8px] font-black text-white/20 uppercase tracking-widest">Total</span>
                            <span className="text-sm font-black text-white">{totalAttempts.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {/* Linha de Sucessos */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Concluídos</span>
                        <span className="text-[10px] font-black text-white">{summary?.total_sent.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${successRate}%` }}
                        />
                    </div>
                </div>

                {/* Linha de Erros */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Falhas</span>
                        <span className="text-[10px] font-black text-white">{summary?.total_failed.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-red-500/60 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${failureRate}%` }}
                        />
                    </div>
                </div>
            </div>
          </TactileCard>

          {/* 2. Performance (Gráfico) */}
          <TactileCard className={cn(
            "p-6 border-none bg-anthracite-surface/40 relative",
            isLoadingCharts && "opacity-60 grayscale-[0.5] transition-all duration-300"
          )}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center",
                  isLoadingCharts && "animate-bounce"
                )}>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-white/90">Evolução Temporal</h3>
                  <p className="text-[8px] text-white/20 uppercase tracking-widest">Ritmo de envios ({period})</p>
                </div>
              </div>
            </div>

            <div className="h-[200px] w-full">
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
                      borderRadius: '8px', 
                      fontSize: '9px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }} 
                  />
                  <Bar dataKey="enviados" name="Sucesso" fill="url(#barGradient)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="falhas" name="Falhas" fill="#ef4444" radius={[2, 2, 0, 0]} opacity={0.6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TactileCard>
        </div>

        {/* COLUNA DIREITA/SIDEBAR (1/3) */}
        <div className="space-y-6">
          
          {/* 4. Pulso Operacional (Atividade Recente) */}
          <TactileCard className="p-0 border-none bg-anthracite-surface/40 overflow-hidden shadow-skeuo-flat mb-6">
            <div className="p-6 pb-4 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-kinetic-orange/10 flex items-center justify-center shadow-skeuo-pressed">
                    <Zap className="w-4 h-4 text-kinetic-orange animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-white/90">Pulso Operacional</h3>
                    <p className="text-[8px] text-white/20 uppercase tracking-[0.2em] font-bold">Atividade em tempo real</p>
                  </div>
                </div>
                <Link href="/relatorios" className="p-2 hover:bg-white/5 rounded-lg transition-colors group">
                  <ArrowRight size={14} className="text-white/20 group-hover:text-kinetic-orange transition-colors" />
                </Link>
              </div>
            </div>

            <div className="divide-y divide-white/5 max-h-[480px] overflow-y-auto scrollbar-thin">
              {history && history.length > 0 ? (
                history.slice(0, 10).map((item, i) => {
                  const Icon = item.type === 'campaign' ? Send : (item.type === 'radar' ? TrendingUp : Zap);
                  const statusConfig = {
                    success: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Concluído' },
                    failed: { color: 'text-red-400', bg: 'bg-red-500/10', label: 'Falha' },
                    processing: { color: 'text-kinetic-orange', bg: 'bg-kinetic-orange/10', label: 'Processando' },
                    info: { color: 'text-indigo-400', bg: 'bg-indigo-500/10', label: 'Info' },
                  };
                  const currentStatus = item.status || 'info';
                  const config = statusConfig[currentStatus];

                  return (
                    <div key={item.id || i} className="flex items-start gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors group relative overflow-hidden">
                      {/* Active indicator line */}
                      <div className={cn("absolute left-0 top-0 bottom-0 w-0.5 opacity-0 group-hover:opacity-100 transition-opacity", config.bg.replace('/10', ''))} />
                      
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-skeuo-pressed border border-white/5",
                        config.bg
                      )}>
                        <Icon size={16} className={cn(config.color)} />
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-black uppercase text-white/80 truncate leading-none">
                            {item.event}
                          </p>
                          <span className="text-[8px] font-bold text-white/20 uppercase whitespace-nowrap">
                            {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                           <Badge variant="outline" className={cn(
                             "h-4 text-[7px] font-black uppercase px-2 border-none", 
                             config.bg, config.color
                           )}>
                             {config.label}
                           </Badge>
                           {item.envios !== undefined && (
                             <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">
                               {item.envios} Envios
                             </span>
                           )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-center px-10 opacity-40">
                   <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4 border border-dashed border-white/10">
                     <Clock className="w-6 h-6 text-white/20" />
                   </div>
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Pulso Ausente</h4>
                   <p className="text-[8px] font-bold uppercase text-white/20 tracking-tighter">Nenhuma atividade operacional detectada no período selecionado.</p>
                </div>
              )}
            </div>
          </TactileCard>

        </div>
      </div>
    </LayoutContainer>
  );
}

