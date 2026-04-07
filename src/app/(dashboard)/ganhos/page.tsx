// src/app/(dashboard)/ganhos/page.tsx
'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/shared/PageHeader';
import {
    Upload, TrendingUp, DollarSign, ShoppingCart, 
    FileSpreadsheet, CheckCircle2, BarChart3, Store,
    Download, Loader2, AlertCircle
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useEarningsSummary, useImportHistory, useImportShopee } from '@/hooks/use-earnings';

const MARKETPLACE_COLORS: Record<string, string> = {
    Shopee: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    Amazon: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    Magalu: 'bg-red-500/10 text-red-600 border-red-500/20',
    'Mercado Livre': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
};

export default function GanhosPage() {
    const [showImportArea, setShowImportArea] = useState(false);
    const [dragging, setDragging] = useState(false);

    const { data: summary, isLoading: isLoadingSummary } = useEarningsSummary();
    const { data: history, isLoading: isLoadingHistory } = useImportHistory();
    const { mutate: importShopee, isPending: isImporting } = useImportShopee();

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(file);
        }
    };

    const processFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            importShopee(content, {
                onSuccess: () => setShowImportArea(false)
            });
        };
        reader.readAsText(file);
    };

    if (isLoadingSummary || isLoadingHistory) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <PageHeader title="Ganhos & Comissões" description="Importe relatórios dos marketplaces e acompanhe suas comissões">
                <Button size="sm" className="bg-primary text-white" onClick={() => setShowImportArea(!showImportArea)}>
                    <Upload className="w-4 h-4 mr-2" /> Importar relatório
                </Button>
            </PageHeader>

            {/* Import area */}
            {showImportArea && (
                <Card className="p-5 border-primary/30">
                    <h3 className="font-semibold mb-1">Importar relatório do marketplace</h3>
                    <p className="text-xs text-muted-foreground mb-4">Exporte o relatório de comissões do seu marketplace (apenas CSV Shopee nesta fase) e importe aqui.</p>

                    {isImporting ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-3">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <p className="text-sm font-medium">Processando arquivo...</p>
                            <p className="text-xs text-muted-foreground">Mapeando colunas e salvando itens no banco</p>
                        </div>
                    ) : (
                        <div
                            onDragOver={e => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={handleFileDrop}
                            className={`border-2 border-dashed rounded-xl p-10 text-center transition-all ${dragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                                }`}
                        >
                            <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                            <p className="font-semibold mb-1">Arraste o arquivo CSV aqui</p>
                            <p className="text-xs text-muted-foreground mb-4">Suporte inicial apenas para relatórios da Shopee</p>
                            <label>
                                <Button size="sm" variant="outline" asChild>
                                    <span className="cursor-pointer">
                                        <Upload className="w-3.5 h-3.5 mr-2" /> Selecionar arquivo
                                    </span>
                                </Button>
                                <input type="file" accept=".csv" onChange={handleFileInput} className="hidden" />
                            </label>
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 mt-4">
                        {['Shopee'].map(mp => (
                            <div key={mp} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 text-xs">
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                                <span>{mp} suportado</span>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Cards de resumo */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="p-4 border-green-500/30 bg-green-500/5">
                    <DollarSign className="w-5 h-5 text-green-500 mb-2" />
                    <p className="text-3xl font-black text-green-600">R$ {summary?.total_commissions.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-1">comissões totais</p>
                </Card>
                <Card className="p-4">
                    <ShoppingCart className="w-5 h-5 text-primary mb-2" />
                    <p className="text-3xl font-black">{summary?.total_orders}</p>
                    <p className="text-xs text-muted-foreground mt-1">pedidos gerados</p>
                </Card>
                <Card className="p-4">
                    <TrendingUp className="w-5 h-5 text-blue-500 mb-2" />
                    <div className="flex items-center gap-1">
                      <p className="text-3xl font-black">---</p>
                      <Badge variant="secondary" className="text-[10px]">Não rastreado</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">cliques rastreados</p>
                </Card>
                <Card className="p-4">
                    <BarChart3 className="w-5 h-5 text-purple-500 mb-2" />
                    <p className="text-3xl font-black">R$ {summary?.avg_commission.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-1">comissão média / pedido</p>
                </Card>
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
                {/* Gráfico evolução */}
                <Card className="lg:col-span-2 p-5">
                    <h3 className="font-semibold mb-4">Evolução de Ganhos</h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={summary?.monthly_data}>
                            <defs>
                                <linearGradient id="colorGanhos" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                            <Tooltip
                                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                                formatter={(v: number) => [`R$ ${v.toFixed(2)}`, 'Ganhos']}
                            />
                            <Area type="monotone" dataKey="ganhos" stroke="hsl(var(--primary))" fill="url(#colorGanhos)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </Card>

                {/* Top produtos */}
                <Card className="p-5">
                    <h3 className="font-semibold mb-3 text-sm">Top produtos por comissão</h3>
                    <div className="space-y-3">
                        {summary?.top_products.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-10 opacity-40">
                             <AlertCircle className="w-5 h-5 mb-1" />
                             <p className="text-xs">Nenhum dado importado</p>
                          </div>
                        )}
                        {summary?.top_products.map((p, i) => (
                            <div key={i} className="flex items-center gap-2.5">
                                <span className="text-xs text-muted-foreground w-4 font-bold">{i + 1}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{p.name}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <Badge variant="outline" className={`text-xs ${MARKETPLACE_COLORS[p.marketplace] || ''}`}>{p.marketplace}</Badge>
                                        <span className="text-xs text-muted-foreground">{p.orders} vendas</span>
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-green-600 flex-shrink-0">R$ {p.commission_total.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Histórico de importações */}
            <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Histórico de importações</h3>
                    <p className="text-xs text-muted-foreground">{history?.length || 0} importações</p>
                </div>
                <div className="space-y-2">
                    {history?.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-10">Nenhuma importação realizada ainda.</p>
                    )}
                    {history?.map(e => (
                        <div key={e.id} className="flex items-center gap-4 p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Store className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold">{e.marketplace}</p>
                                    <Badge variant="outline" className={`text-xs ${e.status === 'completed' ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}`}>
                                        {e.status === 'completed' ? (
                                          <><CheckCircle2 className="w-2.5 h-2.5 mr-1" />Processado</>
                                        ) : (
                                          <><AlertCircle className="w-2.5 h-2.5 mr-1" />Falhou</>
                                        )}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">{e.period} · {e.products_count} produtos · {e.total_orders} pedidos</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <p className="text-sm font-bold text-green-600">R$ {Number(e.total_commissions).toFixed(2)}</p>
                                <p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString('pt-BR')}</p>
                            </div>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <Download className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}
