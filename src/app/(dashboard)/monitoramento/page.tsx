'use client';

import React from 'react';
import { Activity, Bell, Clock, Zap, Search, Filter } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function MonitoramentoPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Activity size={24} />
            <h1 className="text-3xl font-bold tracking-tight">Monitoramento Real-time</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Acompanhe o desempenho das suas campanhas, cliques e conversões em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-3 py-1 gap-1.5 bg-primary/5 border-primary/20 text-primary animate-pulse">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                LIVE
            </Badge>
            <Button size="sm" variant="outline" className="gap-2">
                <Bell size={16} /> Alertas
            </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card/50 backdrop-blur-sm border-primary/10 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Zap size={48} className="text-primary" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription>Cliques Hoje</CardDescription>
            <CardTitle className="text-3xl font-bold">0</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="text-primary font-medium">0%</span> vs ontem
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 backdrop-blur-sm border-primary/10 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Activity size={48} className="text-primary" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription>Conversões</CardDescription>
            <CardTitle className="text-3xl font-bold">0</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="text-primary font-medium">0%</span> vs ontem
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-primary/10 shadow-sm overflow-hidden relative">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Clock size={48} className="text-primary" />
          </div>
          <CardHeader className="pb-2">
            <CardDescription>Tempo de Resposta</CardDescription>
            <CardTitle className="text-3xl font-bold">-- ms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">Média global</div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-primary/10 shadow-sm overflow-hidden relative border-dashed bg-primary/[0.02]">
          <CardHeader className="pb-2 text-center h-full flex flex-col justify-center items-center">
            <div className="p-2 bg-primary/10 rounded-full mb-2">
                <Zap size={20} className="text-primary" />
            </div>
            <CardTitle className="text-sm font-semibold">Nova Métrica</CardTitle>
            <CardDescription className="text-xs">Clique para adicionar</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card className="border shadow-md bg-card/60 overflow-hidden">
        <CardHeader className="bg-muted/30 border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">Fluxo de Eventos Digitais</CardTitle>
              <CardDescription>Logs em tempo real das interações capturadas.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Filtrar eventos..." className="pl-9 h-9 w-[200px] bg-background" />
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9">
                <Filter size={16} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
            <div className="relative">
                <Activity size={48} className="text-primary/20" />
                <Zap size={24} className="text-primary absolute -bottom-1 -right-1 animate-bounce" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold tracking-tight">Aguardando Eventos</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Implementação de rastreamento real em andamento. <br />
                Os dados aparecerão aqui automaticamente.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
                <Badge variant="secondary" className="font-mono bg-muted/50 border-none px-2 py-0.5 text-[10px]">WEBHOOKS_PENDING</Badge>
                <Badge variant="secondary" className="font-mono bg-muted/50 border-none px-2 py-0.5 text-[10px]">TRACKING_V2_READY</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
