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

import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function PlansPage() {
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [errorBase, setErrorBase] = useState<string | null>(null);
  
  // Estados para Simulação
  const [simulationEnabled, setSimulationEnabled] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [planToSimulate, setPlanToSimulate] = useState<any>(null);

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

        // Verificar permissão de simulação via API
        try {
          const simRes = await fetch('/api/billing/simulation-access');
          if (simRes.ok) {
            const simData = await simRes.json();
            setSimulationEnabled(simData.enabled === true);
          }
        } catch (e) {
          console.error('Erro ao verificar acesso à simulação:', e);
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

  const handleSubscribeKiwify = (plan: any) => {
    const checkoutUrl = plan.metadata?.kiwify_checkout_url;
    if (checkoutUrl) {
      window.open(checkoutUrl, '_blank');
    } else {
      toast.info("Checkout da Kiwify ainda não configurado para este plano.");
    }
  };

  const handleSimulatePayment = async () => {
    if (!planToSimulate) return;
    
    try {
      setIsSimulating(true);
      const res = await fetch("/api/billing/simulate-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug: planToSimulate.slug })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || data.error || "Erro na simulação");
      }

      toast.success(data.message || "Plano ativado com sucesso!");
      
      // Refresh total para atualizar estados de acesso
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 1500);

    } catch (err: any) {
      console.error("[SIMULATION] Erro:", err);
      toast.error(err.message || "Erro ao simular pagamento.");
    } finally {
      setIsSimulating(false);
      setPlanToSimulate(null);
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
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto mt-8">
          {plans.map((plan) => (
            <TactileCard 
              key={plan.id}
              className={cn(
                "relative flex flex-col p-8 transition-all duration-500 overflow-hidden border border-white/[0.02]",
                plan.slug === 'lunar' ? "shadow-[0_0_40px_rgba(255,107,0,0.1)] ring-1 ring-kinetic-orange/20 z-10" : "opacity-90 hover:opacity-100"
              )}
            >
              {/* Material Glow for Recommended */}
              {plan.slug === 'lunar' && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-kinetic-orange/10 blur-[50px] -translate-y-1/2 translate-x-1/2 rounded-full" />
              )}

              {plan.slug === 'lunar' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-kinetic-orange text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full flex items-center gap-1.5 shadow-glow-orange-intense border-2 border-deep-void">
                  <Sparkles className="w-3 h-3" />
                  RECOMENDADO
                </div>
              )}
              
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  {plan.slug === 'synco-scale' ? <Rocket className="w-6 h-6 text-kinetic-orange" /> : 
                   plan.slug === 'synco-pro' ? <Zap className="w-6 h-6 text-kinetic-orange" /> :
                   <PackageSearch className="w-6 h-6 text-white/20" />}
                  <h3 className="text-2xl font-black italic uppercase tracking-widest text-white/90">{plan.name}</h3>
                </div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-xs font-black text-white/20 uppercase tracking-widest">R$</span>
                  <span className="text-5xl font-black font-headline text-white/90 italic tracking-tighter">
                    {typeof plan.price_monthly === 'number' ? plan.price_monthly.toLocaleString('pt-BR', { minimumFractionDigits: 0 }) : plan.price_monthly}
                  </span>
                  <span className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">/mês</span>
                </div>
              </div>

              <div className="h-px w-full bg-white/[0.03] mb-8" />

              <ul className="flex-1 space-y-4 mb-10">
                <li className="flex gap-3 items-start group">
                  <div className="w-5 h-5 mt-0.5 rounded-full bg-emerald-500/10 flex items-center justify-center shadow-skeuo-pressed shrink-0">
                    <Check className="w-3 h-3 text-emerald-500" />
                  </div>
                  <span className="text-[11px] font-bold text-white/60 group-hover:text-white transition-colors">
                    <b className="text-white/90">{plan.limits.quotas.max_channels}</b> {plan.limits.quotas.max_channels === 1 ? 'conexão' : 'conexões'} WhatsApp
                  </span>
                </li>
                <li className="flex gap-3 items-start group">
                  <div className="w-5 h-5 mt-0.5 rounded-full bg-emerald-500/10 flex items-center justify-center shadow-skeuo-pressed shrink-0">
                    <Check className="w-3 h-3 text-emerald-500" />
                  </div>
                  <span className="text-[11px] font-bold text-white/60 group-hover:text-white transition-colors">
                    Até <b className="text-white/90">{plan.limits.quotas.max_groups_sync}</b> grupos
                  </span>
                </li>
                <li className="flex gap-3 items-start group">
                  <div className={`w-5 h-5 mt-0.5 rounded-full flex items-center justify-center shrink-0 shadow-skeuo-pressed ${plan.limits.quotas.max_radars > 0 ? 'bg-kinetic-orange/10' : 'bg-white/5'}`}>
                    <Check className={`w-3 h-3 ${plan.limits.quotas.max_radars > 0 ? 'text-kinetic-orange' : 'text-white/20'}`} />
                  </div>
                  <span className={`text-[11px] font-bold group-hover:text-white transition-colors ${plan.limits.quotas.max_radars > 0 ? 'text-white/80' : 'text-white/30'}`}>
                    {plan.limits.quotas.max_radars > 0 ? (
                      <>Até <b className="text-white/90">{plan.limits.quotas.max_radars}</b> Radares ativos</>
                    ) : (
                      "Sem Radar automático"
                    )}
                  </span>
                </li>
                <li className="flex gap-3 items-start group">
                  <div className="w-5 h-5 mt-0.5 rounded-full bg-emerald-500/10 flex items-center justify-center shadow-skeuo-pressed shrink-0">
                    <Check className="w-3 h-3 text-emerald-500" />
                  </div>
                  <span className="text-[11px] font-bold text-white/60 group-hover:text-white transition-colors">
                    <b className="text-white/90">{(plan.limits.quotas.max_sends_per_month / 1000).toLocaleString('pt-BR')}k</b> envios mensais
                  </span>
                </li>

                <li className="flex gap-3 items-start group">
                  <div className="w-5 h-5 mt-0.5 rounded-full bg-white/5 flex items-center justify-center shadow-skeuo-pressed shrink-0">
                    <Check className="w-3 h-3 text-white/40" />
                  </div>
                  <span className="text-[11px] font-bold text-white/60 group-hover:text-white transition-colors">
                    Envio rápido & IA para promoções
                  </span>
                </li>

                <li className="flex gap-3 items-start group">
                  <div className="w-5 h-5 mt-0.5 rounded-full bg-white/5 flex items-center justify-center shadow-skeuo-pressed shrink-0">
                    <Check className="w-3 h-3 text-white/40" />
                  </div>
                  <span className="text-[11px] font-bold text-white/60 group-hover:text-white transition-colors">
                    Integração Shopee
                  </span>
                </li>

                {plan.slug !== 'synco-start' && (
                  <li className="flex gap-3 items-start group">
                    <div className="w-5 h-5 mt-0.5 rounded-full bg-white/5 flex items-center justify-center shadow-skeuo-pressed shrink-0">
                      <Check className="w-3 h-3 text-white/40" />
                    </div>
                    <span className="text-[11px] font-bold text-white/60 group-hover:text-white transition-colors">
                      Dashboard de métricas
                    </span>
                  </li>
                )}

                <li className="flex gap-3 items-start group">
                  <div className="w-5 h-5 mt-0.5 rounded-full bg-white/5 flex items-center justify-center shadow-skeuo-pressed shrink-0">
                    <Check className="w-3 h-3 text-white/40" />
                  </div>
                  <span className="text-[11px] font-bold text-white/60 group-hover:text-white transition-colors">
                    Suporte {plan.slug === 'synco-start' ? 'básico' : 'prioritário'}
                  </span>
                </li>
              </ul>
 
              <div className="space-y-3">
                <KineticButton 
                  type="button"
                  onClick={() => handleSubscribeKiwify(plan)}
                  className="w-full h-14 text-[11px] uppercase font-black tracking-[0.2em] shadow-glow-orange/10"
                >
                  Assinar pela Kiwify
                </KineticButton>

                {simulationEnabled && (
                  <Button 
                    variant="ghost"
                    onClick={() => setPlanToSimulate(plan)}
                    className="w-full h-12 text-[9px] uppercase font-bold tracking-[0.3em] bg-white/5 hover:bg-white/10 text-white/30 hover:text-white/60 border-none rounded-xl"
                  >
                    Simular Pagamento
                  </Button>
                )}
              </div>
            </TactileCard>
          ))}
        </div>
      )}

      {/* Modal de Simulação */}
      <AlertDialog open={!!planToSimulate} onOpenChange={(open) => !open && setPlanToSimulate(null)}>
        <AlertDialogContent className="bg-anthracite-surface border-white/5 rounded-[32px] shadow-skeuo-elevated">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-widest italic font-headline text-white/90">
              Confirmar Pagamento Simulado?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/40 font-medium text-sm leading-relaxed">
              Isso vai ativar o plano <b className="text-white/80 uppercase">{planToSimulate?.name}</b> para o seu usuário por 30 dias, 
              exatamente como se o pagamento real via Kiwify tivesse sido aprovado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-3">
            <AlertDialogCancel className="bg-white/5 border-none text-white/40 hover:bg-white/10 hover:text-white rounded-2xl h-12 font-bold uppercase text-[10px] tracking-widest transition-all">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleSimulatePayment();
              }}
              disabled={isSimulating}
              className="bg-kinetic-orange hover:bg-kinetic-orange/80 text-white border-none rounded-2xl h-12 font-black uppercase text-[10px] tracking-[0.2em] shadow-glow-orange/20 transition-all min-w-[140px]"
            >
              {isSimulating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Pagamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

