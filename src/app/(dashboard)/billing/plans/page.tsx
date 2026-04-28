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
  const [errorBase, setErrorBase] = useState<string | null>(null);

  useEffect(() => {
    async function loadPlans() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('plans')
          .select('*')
          .eq('is_active', true)
          .order('price_monthly', { ascending: true });

        if (error) throw error;
        
        if (data) {
          setPlans(data);
        }
      } catch (err: any) {
        console.error('Erro ao carregar planos:', err);
        setErrorBase('Não foi possível carregar os planos. Tente novamente.');
      } finally {
        setLoadingBase(false);
      }
    }
    loadPlans();
  }, []);

  const handleSubscribe = async (planSlug: string) => {
    try {
      setLoadingPlan(planSlug);
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Erro ao iniciar checkout");
      }

      if (!data.checkoutUrl) {
        throw new Error("URL de checkout não retornada pelo servidor.");
      }

      // Redireciona pro Mercado Pago
      window.location.href = data.checkoutUrl;

    } catch (err: any) {
      console.error("[CHECKOUT] Erro:", err);
      toast.error(err.message || "Não foi possível iniciar o checkout.");
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
          <div className="flex flex-col items-center justify-center p-24 bg-anthracite-surface/40 rounded-[56px] border border-white/[0.01] max-w-4xl mx-auto shadow-skeuo-pressed">
              <Loader2 className="w-12 h-12 animate-spin text-kinetic-orange mb-4" />
              <p className="text-white/30 font-bold uppercase text-[10px] tracking-[0.3em]">Carregando planos táticos...</p>
          </div>
      ) : errorBase ? (
          <div className="p-20 text-center bg-red-500/5 rounded-[48px] shadow-skeuo-pressed border border-red-500/10 max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-500">
            <h3 className="text-2xl font-black uppercase tracking-[0.2em] text-white/90 font-headline italic">Erro de Conexão</h3>
            <p className="text-white/30 mt-4 leading-relaxed font-bold uppercase text-[10px] tracking-widest">{errorBase}</p>
            <Button onClick={() => window.location.reload()} className="mt-8 px-10 h-14 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 border-none">
              Tentar Novamente
            </Button>
          </div>
      ) : plans.length === 0 ? (
          <div className="p-24 text-center bg-anthracite-surface/40 rounded-[56px] shadow-skeuo-pressed border border-white/[0.01] max-w-4xl mx-auto">
            <h3 className="text-2xl font-black uppercase tracking-[0.2em] text-white/20 font-headline italic">Nenhum plano disponível</h3>
            <p className="text-white/10 mt-4 leading-relaxed font-bold uppercase text-[9px] tracking-[0.3em]">No momento não há planos ativos para contratação.</p>
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
                type="button"
                onClick={() => handleSubscribe(plan.slug)}
                disabled={loadingPlan !== null}
                className={cn(
                  "w-full h-16 text-[11px] uppercase font-black tracking-[0.2em]",
                  plan.name !== 'Pro' && "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white shadow-skeuo-flat"
                )}
              >
                {loadingPlan === plan.slug ? <Loader2 className="w-5 h-5 animate-spin" /> : 'CONTRATAR AGORA'}
              </KineticButton>
            </TactileCard>
          ))}
        </div>
      )}
    </div>
  );
}
