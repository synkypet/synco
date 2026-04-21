'use client';

import React, { useState } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Zap, 
  Megaphone, 
  ArrowUpRight, 
  Download,
  AlertCircle,
  ShoppingBag
} from 'lucide-react';
import { TactileCard } from '@/components/ui/TactileCard';
import { StatCard } from '@/components/ui/StatCard';
import { KineticButton } from '@/components/ui/KineticButton';
import ImportDrawer from '@/components/earnings/ImportDrawer';
import { useAuth } from '@/contexts/AuthContext';
import { earningsService } from '@/services/supabase/earnings-service';
import { cn } from '@/lib/utils';

export default function GanhosPage() {
  const { user } = useAuth();
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [stats, setStats] = useState<{
    real: any,
    operational: any,
    recentOrders: any[],
    loading: boolean
  }>({
    real: null,
    operational: null,
    recentOrders: [],
    loading: true
  });

  const fetchData = async () => {
    if (!user) return;
    setStats(prev => ({ ...prev, loading: true }));
    try {
      const [real, operational, recentOrders] = await Promise.all([
        earningsService.getRealStats(user.id),
        earningsService.getOperationalStats(user.id),
        earningsService.getRecentOrders(user.id)
      ]);
      setStats({ 
        real, 
        operational, 
        recentOrders,
        loading: false 
      });
    } catch (err) {
      console.error('Erro ao buscar estatísticas:', err);
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [user]);

  return (
    <div className="p-6 lg:p-8 space-y-8 animate-in fade-in duration-500">
      <ImportDrawer 
        isOpen={isImportOpen} 
        onClose={() => setIsImportOpen(false)}
        onImportComplete={() => {
          setIsImportOpen(false);
          fetchData();
        }}
      />
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase font-headline">
            Dashboard de Performance
          </h1>
          <p className="text-white/40 text-sm mt-1">
            Balanço entre esforço operacional e resultados financeiros reais.
          </p>
        </div>

        <KineticButton 
          onClick={() => setIsImportOpen(true)}
          className="flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          <span>Importar Relatório Shopee</span>
        </KineticButton>
      </div>

      {/* Grid de Stats - Nível Financeiro Real (Auditado) */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <div className="w-1.5 h-4 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
          <h2 className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-[0.2em]">
            Financeiro Real (Shopee)
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard
            label="Ganhos Confirmados"
            value={`R$ ${(stats.real?.totalConfirmed || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<DollarSign className="w-4 h-4" />}
            trend={stats.loading ? { value: '...', positive: true } : undefined}
            description="Baseado em pedidos concluídos"
            colorScheme="success"
          />
          <StatCard
            label="Vendas Realizadas"
            value={stats.real?.totalOrders?.toString() || '0'}
            icon={<TrendingUp className="w-4 h-4" />}
            trend={stats.loading ? { value: '...', positive: true } : undefined}
            description="Total de itens convertidos"
            colorScheme="success"
          />
          <StatCard
            label="Ganhos Pendentes"
            value={`R$ ${(stats.real?.totalPending || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            icon={<AlertCircle className="w-4 h-4" />}
            description="Pedidos aguardando validação"
          />
        </div>
      </section>

      {/* Grid de Stats - Nível Operacional (Fato Interno) */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <div className="w-1.5 h-4 bg-kinetic-orange rounded-full shadow-glow-orange" />
          <h2 className="text-[10px] font-bold text-kinetic-orange/80 uppercase tracking-[0.2em]">
            Operacional (Interno)
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Mensagens Enviadas"
            value={stats.operational?.totalJobs?.toString() || '0'}
            icon={<Zap className="w-4 h-4" />}
            description="Total de jobs dispersados"
            colorScheme="kinetic"
          />
          <StatCard
            label="Campanhas Ativas"
            value={stats.operational?.totalCampaigns?.toString() || '0'}
            icon={<Megaphone className="w-4 h-4" />}
            description="Esteiras em execução"
            colorScheme="kinetic"
          />
          <StatCard
            label="Produtos Descobertos"
            value="--"
            icon={<ArrowUpRight className="w-4 h-4" />}
            description="Minerados pelo Radar"
            colorScheme="kinetic"
          />
          <StatCard
            label="Cliques Estimados"
            value="--"
            icon={<Zap className="w-4 h-4" />}
            description="Aguardando Click Tracker"
          />
        </div>
      </section>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Atividade Recente */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">
            Logs de Conversão Recentes
          </h3>
          
          <div className="space-y-3">
            {stats.loading ? (
              [1,2,3].map(i => <TactileCard key={i} className="h-20 animate-pulse bg-white/5" />)
            ) : stats.recentOrders?.length > 0 ? (
              stats.recentOrders.map((order: any) => (
                <TactileCard key={order.id} className="p-4 flex items-center justify-between group hover:bg-white/[0.03] transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white/20">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white/80 line-clamp-1">{order.product_name || 'Produto Shopee'}</h4>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest font-black">
                        ID: {order.order_id} • {new Date(order.order_time).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-emerald-500 font-headline">
                      + R$ {Number(order.actual_commission || order.estimated_commission).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <div className={cn(
                      "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full inline-block mt-1",
                      order.order_status?.toLowerCase() === 'completed' || order.order_status?.toLowerCase() === 'concluído' 
                        ? "bg-emerald-500/10 text-emerald-500" 
                        : "bg-white/10 text-white/40"
                    )}>
                      {order.order_status}
                    </div>
                  </div>
                </TactileCard>
              ))
            ) : (
              <TactileCard className="min-h-[300px] flex flex-col items-center justify-center p-12 text-center">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                  <FileSearch className="w-8 h-8 text-white/20" />
                </div>
                <h4 className="text-white/60 font-medium">Nenhum dado financeiro</h4>
                <p className="text-white/20 text-sm mt-2 max-w-xs">
                  Importe um relatório oficial da Shopee para começar a visualizar sua performance real.
                </p>
              </TactileCard>
            )}
          </div>
        </div>

        {/* Sidebar de Ganhos/Resumo */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest px-1">
            Histórico de Importação
          </h3>
          <TactileCard className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/30 uppercase tracking-widest">Último Lote</span>
              <span className="text-[10px] text-white/60 font-bold">NUNCA</span>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            <p className="text-xs text-white/40 italic text-center">
              Ainda não existem lotes processados.
            </p>
          </TactileCard>
        </div>
      </div>
    </div>
  );
}

// Ícone temporário enquanto não importamos Lucide corretamente
function FileSearch({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
      <polyline points="14 2 14 8 20 8"/>
      <circle cx="10" cy="13" r="3"/>
      <path d="m16 19-2.5-2.5"/>
    </svg>
  );
}
