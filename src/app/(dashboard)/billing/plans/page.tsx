"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Loader2, Sparkles, Zap, PackageSearch, Rocket } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { TactileCard } from "@/components/ui/TactileCard";
import { KineticButton } from "@/components/ui/KineticButton";
import { cn } from "@/lib/utils";

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
      <div className="flex items-center gap-4 mb-10">
        <Button variant="ghost" size="icon" onClick={() => router.push('/billing')} className="bg-white/5 rounded-xl hover:bg-white/10 border-none shadow-skeuo-flat">
          <ArrowLeft className="w-5 h-5 text-white/40" />
        </Button>
        <div className="flex flex-col">
          <h2 className="text-3xl font-black uppercase tracking-[0.2em] italic font-headline text-white/90">Potencialize sua Operação</h2>
          <p className="text-white/30 font-bold uppercase text-[10px] tracking-widest mt-1">Escolha o plano ideal para sua escala de automação</p>
        </div>
      </div>

      {loadingBase ? (
          <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mt-8">
          {plans.map((plan) => (
            <TactileCard 
              key={plan.id}
              className={cn(
                "relative flex flex-col p-8 transition-all duration-500 overflow-hidden",
                plan.name === 'Pro' ? "shadow-[0_0_40px_rgba(255,107,0,0.1)] scale-[1.02] z-10" : "opacity-80 hover:opacity-100"
              )}
            >
              {/* Material Glow for Recommended */}
              {plan.name === 'Pro' && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-kinetic-orange/10 blur-[50px] -translate-y-1/2 translate-x-1/2 rounded-full" />
              )}

              {plan.name === 'Pro' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-kinetic-orange text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full flex items-center gap-1.5 shadow-glow-orange-intense border-2 border-deep-void">
                  <Sparkles className="w-3 h-3" />
                  RECOMENDADO
                </div>
              )}
              
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  {plan.name === 'Pro' ? <Rocket className="w-6 h-6 text-kinetic-orange" /> : <PackageSearch className="w-6 h-6 text-white/20" />}
                  <h3 className="text-2xl font-black italic uppercase tracking-widest text-white/90">{plan.name}</h3>
                </div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-xs font-black text-white/20 uppercase tracking-widest">R$</span>
                  <span className="text-5xl font-black font-headline text-white/90 italic tracking-tighter">{plan.price_monthly}</span>
                  <span className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">/mês</span>
                </div>
              </div>

              <div className="h-px w-full bg-white/[0.03] mb-8" />

              <ul className="flex-1 space-y-5 mb-10">
                <li className="flex gap-3 items-center group">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shadow-skeuo-pressed">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <span className="text-[11px] font-bold text-white/60 group-hover:text-white transition-colors">Até <b className="text-white/90">{plan.limits.quotas.max_channels}</b> canais de WhatsApp</span>
                </li>
                <li className="flex gap-3 items-center group">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shadow-skeuo-pressed">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <span className="text-[11px] font-bold text-white/60 group-hover:text-white transition-colors">Até <b className="text-white/90">{plan.limits.quotas.max_groups_sync}</b> grupos sincronizados</span>
                </li>
                <li className="flex gap-3 items-center group">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shadow-skeuo-pressed">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <span className="text-[11px] font-bold text-white/60 group-hover:text-white transition-colors">Até <b className="text-white/90">{(plan.limits.quotas.max_sends_per_month / 1000).toLocaleString('pt-BR')}k</b> envios/mês</span>
                </li>
                {plan.limits.features.radar_access && (
                  <li className="flex gap-3 items-center group">
                    <div className="w-6 h-6 rounded-full bg-kinetic-orange/10 flex items-center justify-center shadow-glow-orange/20">
                      <Zap className="w-3.5 h-3.5 text-kinetic-orange" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-kinetic-orange flex items-center gap-1 group-hover:drop-shadow-[0_0_5px_rgba(255,107,0,0.5)] transition-all">
                      Acesso ao Radar Pro
                    </span>
                  </li>
                )}
              </ul>
 
              <KineticButton 
                onClick={() => handleSubscribe(plan.id)}
                disabled={loadingPlan !== null}
                className={cn(
                  "w-full h-16 text-[11px] uppercase font-black tracking-[0.2em]",
                  plan.name !== 'Pro' && "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white shadow-skeuo-flat"
                )}
              >
                {loadingPlan === plan.id ? <Loader2 className="w-5 h-5 animate-spin" /> : 'CONTRATAR AGORA'}
              </KineticButton>
            </TactileCard>
          ))}
        </div>
      )}
    </div>
  );
}
