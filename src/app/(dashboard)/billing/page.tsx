"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function BillingDashboardPage() {
  const router = useRouter();
  const [statusObj, setStatusObj] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch("/api/billing/status");
        if (!res.ok) throw new Error("Erro ao carregar dados de assinatura");
        const data = await res.json();
        setStatusObj(data);
      } catch(err: any) {
        toast.error("Erro carregando status");
      } finally {
        setLoading(false);
      }
    }
    loadStatus();
  }, []);

  const handleCancel = async () => {
    if(!confirm("Tem certeza que deseja cancelar sua assinatura? O acesso ficará disponível apenas até o final do período vigente.")) return;
    
    setCanceling(true);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success(data.message);
      window.location.reload();
    } catch(err: any) {
      toast.error(err.message || "Erro no cancelamento");
    } finally {
      setCanceling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { status, planName, quotas, isOperative } = statusObj;

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2 mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Assinatura</h2>
          <p className="text-muted-foreground">Gerencie seu plano e operações de pagamento</p>
        </div>
        <Button onClick={() => router.push('/billing/plans')} variant="default">
          Ver Planos
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="border bg-card p-6 rounded-2xl shadow-skeuo-flat flex flex-col">
          <div className="flex items-center justify-between mb-4">
             <h3 className="font-semibold text-xl">Seu Plano Atual: {planName || "Nenhum"}</h3>
             {status === 'active' && <span className="bg-emerald-500/20 text-emerald-500 px-3 py-1 rounded-full text-xs font-bold uppercase">Ativo</span>}
             {status === 'internal_license' && <span className="bg-blue-500/20 text-blue-500 px-3 py-1 rounded-full text-xs font-bold uppercase"><ShieldCheck className="w-3 h-3 inline mr-1" />Admin Bypass</span>}
             {status === 'past_due' && <span className="bg-yellow-500/20 text-yellow-500 px-3 py-1 rounded-full text-xs font-bold uppercase">Pagamento Pendente</span>}
             {status === 'past_due_restricted' && <span className="bg-red-500/20 text-red-500 px-3 py-1 rounded-full text-xs font-bold uppercase">Bloqueado - Vencido</span>}
             {status === 'canceled' && <span className="bg-zinc-500/20 text-zinc-400 px-3 py-1 rounded-full text-xs font-bold uppercase">Cancelada</span>}
             {status === 'expired_blocked' && <span className="bg-red-500/20 text-red-500 px-3 py-1 rounded-full text-xs font-bold uppercase">Expirada</span>}
          </div>

          <div className="flex-1 space-y-4 mb-8">
             {status === 'none' || status === 'expired_blocked' ? (
                <div className="p-4 bg-red-500/10 text-red-400 rounded-lg flex gap-3 text-sm">
                   <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                   <div>Sua conta não tem acesso aos recursos de envio e automação do SYNCO. Assine um plano.</div>
                </div>
             ) : !isOperative ? (
                <div className="p-4 bg-red-500/10 text-red-400 rounded-lg flex gap-3 text-sm">
                   <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                   <div>Sua assinatura está com o pagamento atrasado além do período de carência. O sistema encontrou-se bloqueado para novas operações. Atualize sua forma de pagamento.</div>
                </div>
             ) : status === 'canceled' ? (
                <div className="p-4 bg-zinc-500/10 text-zinc-300 rounded-lg flex gap-3 text-sm">
                   <AlertTriangle className="w-5 h-5 flex-shrink-0 text-zinc-400" />
                   <div>Sua assinatura foi cancelada. Você ainda pode usar o sistema até o prazo final do seu último pagamento. Após essa data, perderá acesso de envio.</div>
                </div>
             ) : status === 'past_due' ? (
                <div className="p-4 bg-yellow-500/10 text-yellow-500 rounded-lg flex gap-3 text-sm">
                   <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                   <div>Não conseguimos processar a renovação no seu cartão. Você está no período de cortesia para normalizar antes do bloqueio de serviços.</div>
                </div>
             ) : (
                <p className="text-muted-foreground text-sm">Sua conta está operando com limites liberados conforme o contratado. Aproveite!</p>
             )}
          </div>

          {['active', 'past_due', 'trialing'].includes(status) && (
            <div className="mt-auto">
                <Button 
                    variant="destructive" 
                    className="w-full sm:w-auto"
                    onClick={handleCancel}
                    disabled={canceling}
                >
                    {canceling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Cancelar Assinatura
                </Button>
            </div>
          )}
        </div>

        <div className="border bg-card p-6 rounded-2xl shadow-skeuo-flat">
          <h3 className="font-semibold text-xl mb-4">Limites da Operação</h3>
          {quotas ? (
            <div className="space-y-4">
              <div className="flex justify-between border-b pb-2 border-white/5">
                 <span className="text-muted-foreground">Canais do WhatsApp</span>
                 <span className="font-mono font-medium">{quotas.max_channels >= 999 ? 'Ilimitado' : quotas.max_channels}</span>
              </div>
              <div className="flex justify-between border-b pb-2 border-white/5">
                 <span className="text-muted-foreground">Grupos Sincronizados</span>
                 <span className="font-mono font-medium">{quotas.max_groups_sync >= 999 ? 'Ilimitado' : quotas.max_groups_sync}</span>
              </div>
              <div className="flex justify-between pb-2">
                 <span className="text-muted-foreground">Envios por Mês</span>
                 <span className="font-mono font-medium">{quotas.max_sends_per_month >= 99999 ? 'Ilimitado' : quotas.max_sends_per_month.toLocaleString('pt-BR')}</span>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Nenhum limite ativo encontrado.</p>
          )}
        </div>
      </div>
    </div>
  );
}
