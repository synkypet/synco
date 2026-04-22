// src/app/(dashboard)/relatorios/page.tsx
'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';
import {
    CheckCircle2, AlertCircle, Clock,
    Users, TrendingUp, Download, Loader2, BarChart3, History, PieChart as PieChartIcon
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { 
    useOperationalSummary, 
    usePerformanceCharts, 
    useTopGroups, 
    useOperationalHistory 
} from '@/hooks/use-reports';

const TYPE_COLORS: Record<string, string> = {
    campaign: 'bg-green-500/10 text-green-600 border-green-500/20',
    automation: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    monitoring: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
};

const TYPE_LABELS: Record<string, string> = { 
    campaign: 'Campanha', 
    automation: 'Automação', 
    monitoring: 'Monitoramento' 
};

const STATUS_COLORS = {
    sent: '#10b981',
    failed: '#ef4444',
    pending: '#f59e0b'
};

export default function RelatoriosPage() {
    const { user } = useAuth();
    const [period, setPeriod] = useState('week');
    const [tab, setTab] = useState('overview');

    const { data: summary, isLoading: isLoadingSummary } = useOperationalSummary(user?.id, { period });
    const { data: charts, isLoading: isLoadingCharts } = usePerformanceCharts(user?.id, { period });
    const { data: topGroups, isLoading: isLoadingTopGroups } = useTopGroups(user?.id, { period });
    const { data: history, isLoading: isLoadingHistory } = useOperationalHistory(user?.id, { period });

    const isAuthLoading = !user;
    const isLoading = isAuthLoading || isLoadingSummary || isLoadingCharts || isLoadingTopGroups || isLoadingHistory;

    const pieData = [
        { name: 'Sucesso', value: summary?.total_sent || 0, color: STATUS_COLORS.sent },
        { name: 'Falha', value: summary?.total_failed || 0, color: STATUS_COLORS.failed },
        { name: 'Pendente', value: summary?.total_pending || 0, color: STATUS_COLORS.pending },
    ].filter(d => d.value > 0);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    const failureRate = summary && (summary.total_sent + summary.total_failed) > 0 
        ? ((summary.total_failed / (summary.total_sent + summary.total_failed)) * 100).toFixed(1) 
        : '0';

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-6">
            <div className="space-y-8 animate-in fade-in-50 duration-500">
                <PageHeader title="Relatórios Operacionais" description="Análise de envios e evolução da operação">
                    <div className="flex items-center gap-3">
                        <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger className="w-[150px] h-10 text-[10px] font-black uppercase tracking-widest bg-deep-void border-none shadow-skeuo-pressed">
                                <SelectValue placeholder="Período" />
                            </SelectTrigger>
                            <SelectContent className="bg-anthracite-surface border-white/5 shadow-skeuo-elevated">
                                <SelectItem value="today" className="text-[10px] font-black uppercase tracking-widest">Hoje</SelectItem>
                                <SelectItem value="week" className="text-[10px] font-black uppercase tracking-widest">Esta semana</SelectItem>
                                <SelectItem value="month" className="text-[10px] font-black uppercase tracking-widest">Este mês</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" className="h-10 px-4 bg-transparent border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/5">
                            <Download className="w-3.5 h-3.5 mr-2 opacity-50" /> Exportar
                        </Button>
                    </div>
                </PageHeader>

                <Tabs value={tab} onValueChange={setTab} className="space-y-8">
                    <TabsList className="bg-muted/30 p-1 rounded-xl flex-wrap h-auto gap-1 border border-white/5 shadow-skeuo-pressed">
                        <TabsTrigger value="overview" className="text-[10px] uppercase font-black tracking-widest gap-2 rounded-lg">
                            <BarChart3 className="w-3.5 h-3.5" /> Visão Geral
                        </TabsTrigger>
                        <TabsTrigger value="timing" className="text-[10px] uppercase font-black tracking-widest gap-2 rounded-lg">
                            <Clock className="w-3.5 h-3.5" /> Horários
                        </TabsTrigger>
                        <TabsTrigger value="history" className="text-[10px] uppercase font-black tracking-widest gap-2 rounded-lg">
                            <History className="w-3.5 h-3.5" /> Histórico
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {/* KPIs principais */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    <KPICard 
                        label="Enviados" 
                        value={summary?.total_sent} 
                        icon={CheckCircle2} 
                        color="text-emerald-500" 
                        bgColor="bg-emerald-500/5"
                    />
                    <KPICard 
                        label="Pendentes" 
                        value={summary?.total_pending} 
                        icon={Clock} 
                        color="text-amber-500" 
                        bgColor="bg-amber-500/5"
                    />
                    <KPICard 
                        label="Falhas" 
                        value={summary?.total_failed} 
                        icon={AlertCircle} 
                        color="text-rose-500" 
                        bgColor="bg-rose-500/5"
                        subValue={`${failureRate}% taxa`}
                    />
                    <KPICard 
                        label="Grupos Ativos" 
                        value={summary?.active_groups_count} 
                        icon={Users} 
                        color="text-kinetic-orange" 
                        bgColor="bg-kinetic-orange/5"
                    />
                </div>

                {/* Conteúdo por tab */}
                {tab === 'overview' && (
                    <div className="grid md:grid-cols-2 gap-6">
                        <ChartCard title="Envios por Dia (Intervalo)">
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={charts?.weekly}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-white/5" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 900 }} axisLine={false} tickLine={false} />
                                    <Tooltip 
                                        contentStyle={{ background: '#1A1A1E', border: 'none', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', fontSize: '10px', color: '#fff', fontWeight: '900', textTransform: 'uppercase' }}
                                        cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                                    />
                                    <Bar dataKey="enviados" name="Enviados" fill="#FF6B00" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="falhas" name="Falhas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartCard>

                        <ChartCard title="Distribuição de Status">
                            {pieData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={8}
                                            dataKey="value"
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ background: '#1A1A1E', border: 'none', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', fontSize: '10px', color: '#fff', fontWeight: '900', textTransform: 'uppercase' }} />
                                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-[250px] opacity-20">
                                    <PieChartIcon size={40} className="mb-2" />
                                    <p className="text-[10px] uppercase font-black tracking-widest italic">Sem dados no período</p>
                                </div>
                            )}
                        </ChartCard>
                    </div>
                )}

                {tab === 'timing' && (
                    <ChartCard title="Frequência de Envios por Horário" description={`Volume de envios realizados ao longo do dia (Período: ${period})`}>
                        <ResponsiveContainer width="100%" height={320}>
                            <AreaChart data={charts?.hourly}>
                                <defs>
                                    <linearGradient id="colorHour" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#FF6B00" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-white/5" vertical={false} />
                                <XAxis dataKey="hour" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 900 }} axisLine={false} />
                                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 900 }} axisLine={false} />
                                <Tooltip contentStyle={{ background: '#1A1A1E', border: 'none', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', fontSize: '10px', color: '#fff', fontWeight: '900', textTransform: 'uppercase' }} />
                                    <Area type="monotone" dataKey="enviados" name="Envios" stroke="#FF6B00" fill="url(#colorHour)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </ChartCard>
                )}

                {tab === 'history' && (
                    <ChartCard title="Histórico Operacional" description="Log de campanhas e disparos factuais">
                        <div className="space-y-4 py-2">
                            {history?.map((item, i) => (
                                <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-black/20 border border-white/5 shadow-skeuo-pressed hover:bg-black/40 transition-all duration-300 group">
                                    {/* Miniatura do Produto */}
                                    <div className="w-12 h-12 rounded-lg bg-deep-void border border-white/5 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-inner">
                                        {item.imageUrl ? (
                                            <img src={item.imageUrl} alt={item.event} className="w-full h-full object-cover" />
                                        ) : (
                                            <PieChartIcon className="w-5 h-5 text-white/10" />
                                        )}
                                    </div>

                                    <div className="text-[10px] font-black uppercase tracking-widest text-white/30 w-24 flex-shrink-0 italic">{item.date}</div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-black uppercase tracking-tight text-white/80 group-hover:text-kinetic-orange transition-colors truncate italic">
                                            {item.event}
                                        </p>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[9px] font-black uppercase text-white/20 italic">
                                                Enviado para {item.groupCount || 0} {(item.groupCount === 1) ? 'grupo' : 'grupos'}
                                            </span>
                                        </div>
                                    </div>

                                    <Badge variant="outline" className={cn("text-[9px] font-black uppercase tracking-widest border-none px-3 h-6 italic", TYPE_COLORS[item.type])}>
                                        {TYPE_LABELS[item.type]}
                                    </Badge>

                                </div>
                            ))}
                            {(!history || history.length === 0) && (
                                <div className="p-16 text-center rounded-2xl border border-dashed border-white/5 opacity-20">
                                    <History size={32} className="mx-auto mb-2" />
                                    <p className="text-[10px] font-black uppercase tracking-widest italic">Nenhuma campanha registrada no intervalo</p>
                                </div>
                            )}
                        </div>
                    </ChartCard>
                )}
            </div>
        </div>
    );
}

/**
 * KPICard - Componente de métrica premium (Modern Skeuo)
 */
function KPICard({ label, value, icon: Icon, color, bgColor, subValue }: { label: string, value: any, icon: any, color: string, bgColor: string, subValue?: string }) {
    return (
        <Card className="p-5 border-none ring-1 ring-white/5 bg-anthracite-surface/50 shadow-skeuo-flat overflow-hidden relative group">
            <div className={cn("absolute -top-6 -right-6 w-16 h-16 blur-2xl rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-500", bgColor)} />
            <Icon className={cn("w-4 h-4 mb-3", color)} />
            <div className="space-y-1">
                <p className="text-2xl font-black italic font-headline text-white tracking-tighter">
                    {value}
                </p>
                <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/30 italic">{label}</p>
                    {subValue && <p className="text-[9px] font-black uppercase text-white/20 italic">{subValue}</p>}
                </div>
            </div>
        </Card>
    );
}

/**
 * ChartCard - Container para gráficos com estilo Command Center
 */
function ChartCard({ title, description, children }: { title: string, description?: string, children: React.ReactNode }) {
    return (
        <Card className="p-6 border-none ring-1 ring-white/5 bg-anthracite-surface/40 shadow-skeuo-elevated relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            <div className="mb-8">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/60 mb-1 italic font-headline">{title}</h3>
                {description && <p className="text-[9px] font-medium uppercase tracking-widest text-white/20 italic">{description}</p>}
            </div>
            {children}
        </Card>
    );
}
