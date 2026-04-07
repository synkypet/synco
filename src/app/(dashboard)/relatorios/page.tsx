// src/app/(dashboard)/relatorios/page.tsx
'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import {
    CheckCircle2, AlertCircle, Clock,
    Users, TrendingUp, Download, Loader2, BarChart3, History, PieChart as PieChartIcon
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
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

export default function RelatoriosPage() {
    const [period, setPeriod] = useState('week');
    const [tab, setTab] = useState('overview');

    const { data: summary, isLoading: isLoadingSummary } = useOperationalSummary();
    const { data: charts, isLoading: isLoadingCharts } = usePerformanceCharts();
    const { data: topGroups, isLoading: isLoadingTopGroups } = useTopGroups();
    const { data: history, isLoading: isLoadingHistory } = useOperationalHistory();

    const isLoading = isLoadingSummary || isLoadingCharts || isLoadingTopGroups || isLoadingHistory;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    const failureRate = summary && summary.total_sent > 0 
        ? ((summary.total_failed / (summary.total_sent + summary.total_failed)) * 100).toFixed(1) 
        : '0';

    return (
        <div className="space-y-5">
            <PageHeader title="Relatórios Operacionais" description="Análise de envios, alcance e evolução da operação">
                <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger className="w-[150px] h-9 text-sm">
                        <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="today">Hoje</SelectItem>
                        <SelectItem value="week">Esta semana</SelectItem>
                        <SelectItem value="month">Este mês</SelectItem>
                    </SelectContent>
                </Select>
                <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" /> Exportar
                </Button>
            </PageHeader>

            <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="h-9">
                    <TabsTrigger value="overview" className="text-xs flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5" /> Visão Geral
                    </TabsTrigger>
                    <TabsTrigger value="groups" className="text-xs flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> Grupos
                    </TabsTrigger>
                    <TabsTrigger value="timing" className="text-xs flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> Horários
                    </TabsTrigger>
                    <TabsTrigger value="history" className="text-xs flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5" /> Histórico
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            {/* KPIs principais */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card className="p-4 border-green-500/30 bg-green-500/5">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mb-1" />
                    <p className="text-2xl font-black text-green-600">{summary?.total_sent}</p>
                    <p className="text-xs text-muted-foreground">Enviados</p>
                </Card>
                <Card className="p-4 border-yellow-500/20 bg-yellow-500/5">
                    <Clock className="w-4 h-4 text-yellow-500 mb-1" />
                    <p className="text-2xl font-black text-yellow-600">{summary?.total_pending}</p>
                    <p className="text-xs text-muted-foreground">Pendentes</p>
                </Card>
                <Card className="p-4 border-red-500/20 bg-red-500/5">
                    <AlertCircle className="w-4 h-4 text-red-500 mb-1" />
                    <p className="text-2xl font-black text-red-600">{summary?.total_failed}</p>
                    <p className="text-xs text-muted-foreground">Falhas</p>
                    <p className="text-[10px] text-muted-foreground">{failureRate}% taxa</p>
                </Card>
                <Card className="p-4">
                    <Users className="w-4 h-4 text-primary mb-1" />
                    <p className="text-2xl font-black">{summary?.active_groups_count}</p>
                    <p className="text-xs text-muted-foreground">Grupos ativos</p>
                </Card>
                <Card className="p-4 border-primary/20 bg-primary/5">
                    <TrendingUp className="w-4 h-4 text-primary mb-1" />
                    <p className="text-2xl font-black text-primary">
                        {summary && summary.estimated_reach >= 1000 
                            ? `${(summary.estimated_reach / 1000).toFixed(1)}k` 
                            : summary?.estimated_reach}
                    </p>
                    <p className="text-xs text-muted-foreground">Alcance estimado</p>
                </Card>
            </div>

            {/* Conteúdo por tab */}
            {tab === 'overview' && (
                <div className="grid md:grid-cols-2 gap-4">
                    <Card className="p-5">
                        <h3 className="font-semibold mb-4 text-sm">Envios por Dia (Semana)</h3>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={charts?.weekly}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
                                <Bar dataKey="enviados" name="Enviados" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="falhas" name="Falhas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>

                    <Card className="p-5">
                        <h3 className="font-semibold mb-4 text-sm">Distribuição de Status</h3>
                        <div className="flex items-center justify-center h-[220px]">
                           <div className="text-center space-y-2 opacity-50">
                              <PieChartIcon className="w-12 h-12 mx-auto text-muted-foreground" />
                              <p className="text-xs">Gráfico circular será implementado em breve</p>
                           </div>
                        </div>
                    </Card>
                </div>
            )}

            {tab === 'groups' && (
                <div className="grid md:grid-cols-2 gap-4">
                    <Card className="p-5">
                        <h3 className="font-semibold mb-4 text-sm">Top grupos por envios recebidos</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={topGroups} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                                <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} />
                                <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} width={90} axisLine={false} />
                                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
                                <Bar dataKey="enviados" name="Envios" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>

                    <Card className="p-5">
                        <h3 className="font-semibold mb-4 text-sm">Pessoas Alcançadas por Grupo</h3>
                        <div className="space-y-4">
                            {topGroups?.map((g, i) => (
                                <div key={i} className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-medium truncate max-w-[200px]">{g.name}</span>
                                        <span className="font-bold text-primary">{g.membros.toLocaleString()}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div 
                                          className="h-full bg-primary rounded-full transition-all" 
                                          style={{ width: `${Math.min((g.membros / 5000) * 100, 100)}%` }} 
                                        />
                                    </div>
                                </div>
                            ))}
                            {topGroups?.length === 0 && (
                                <p className="text-xs text-muted-foreground text-center py-10">Nenhum dado disponível.</p>
                            )}
                        </div>
                    </Card>
                </div>
            )}

            {tab === 'timing' && (
                <Card className="p-5">
                    <h3 className="font-semibold mb-1 text-sm">Frequência de Envios por Horário</h3>
                    <p className="text-xs text-muted-foreground mb-6">Volume de envios realizados ao longo do dia</p>
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={charts?.hourly}>
                            <defs>
                                <linearGradient id="colorHour" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                            <XAxis dataKey="hour" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} />
                            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
                                <Area type="monotone" dataKey="enviados" name="Envios" stroke="hsl(var(--primary))" fill="url(#colorHour)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </Card>
            )}

            {tab === 'history' && (
                <Card className="p-5">
                    <h3 className="font-semibold mb-4 text-sm">Histórico de Campanhas</h3>
                    <div className="space-y-2">
                        {history?.map((item, i) => (
                            <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                                <div className="text-xs text-muted-foreground w-24 flex-shrink-0">{item.date}</div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{item.event}</p>
                                </div>
                                <Badge variant="outline" className={`text-[10px] flex-shrink-0 h-5 ${TYPE_COLORS[item.type]}`}>
                                    {TYPE_LABELS[item.type]}
                                </Badge>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-xs font-bold text-primary">{item.envios} envios p/ grupos</p>
                                </div>
                            </div>
                        ))}
                        {history?.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-10">Nenhuma campanha registrada no histórico.</p>
                        )}
                    </div>
                </Card>
            )}
        </div>
    );
}
