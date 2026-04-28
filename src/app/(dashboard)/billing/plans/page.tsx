"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Loader2, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function PlansPage() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loadingBase, setLoadingBase] = useState(true);

  useEffect(() => {
    async function loadPlans() {
      const supabase = createClient();
      const { data } = await supabase.from('plans').select('*').order('price_monthly', { ascending: true });
      if (data) {
        setPlans(data);
      }
      setLoadingBase(false);
    }
    loadPlans();
  }, []);

  const handleSubscribe = async (planId: string) => {
    try {
      setLoadingPlan(planId);
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Erro ao iniciar checkout");
      }

      // Redireciona pro Mercado Pago
      window.location.href = data.url;

    } catch (err: any) {
      toast.error(err.message);
      setLoadingPlan(null);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/billing')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-3xl font-bold tracking-tight">Escolha seu Plano</h2>
      </div>

      {loadingBase ? (
          <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mt-8">
          {plans.map((plan) => (
            <div 
              key={plan.id}
              className={`relative flex flex-col p-6 rounded-2xl border bg-card ${plan.name === 'Pro' ? 'border-primary shadow-glow-orange-intense' : 'border-border'}`}
            >
              {plan.name === 'Pro' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  RECOMENDADO
                </div>
              )}
              
              <div className="mb-4">
                <h3 className="text-2xl font-bold">{plan.name}</h3>
                <div className="mt-2 flex items-baseline text-4xl font-extrabold">
                  <span className="text-lg font-medium text-muted-foreground mr-1">R$</span>
                  {plan.price_monthly}
                  <span className="ml-1 text-xl font-medium text-muted-foreground">/mês</span>
                </div>
              </div>

              <ul className="flex-1 space-y-3 mb-6">
                <li className="flex gap-2 items-center">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>Até <b>{plan.limits.quotas.max_channels}</b> canais de WhatsApp</span>
                </li>
                <li className="flex gap-2 items-center">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>Até <b>{plan.limits.quotas.max_groups_sync}</b> grupos sincronizados</span>
                </li>
                <li className="flex gap-2 items-center">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>Até <b>{(plan.limits.quotas.max_sends_per_month / 1000).toLocaleString('pt-BR')}k</b> envios/mês</span>
                </li>
                {plan.limits.features.radar_access && (
                  <li className="flex gap-2 items-center">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-primary font-medium flex items-center gap-1">
                      Acesso ao Radar Pro <Zap className="w-4 h-4" />
                    </span>
                  </li>
                )}
              </ul>

              <Button 
                onClick={() => handleSubscribe(plan.id)}
                disabled={loadingPlan !== null}
                variant={plan.name === 'Pro' ? 'default' : 'outline'}
                className={`w-full py-6 text-lg ${plan.name === 'Pro' ? 'bg-kinetic-orange hover:bg-orange-600' : ''}`}
              >
                {loadingPlan === plan.id ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Assinar Plano'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
