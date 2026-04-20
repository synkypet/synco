'use client';

import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Settings, 
  Smartphone, 
  Users, 
  SendHorizonal, 
  Calendar, 
  Radar, 
  Activity, 
  TrendingUp, 
  BarChart3,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TactileCard } from '@/components/ui/TactileCard';
import { KineticButton } from '@/components/ui/KineticButton';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

// ─── Steps Config ─────────────────────────────────────────────────────────────

const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao SYNCO',
    description: 'Sua central de operações para afiliados. O SYNCO foi projetado para transformar links em comissões através de distribuição inteligente e automatizada.',
    icon: <Zap className="w-8 h-8 text-kinetic-orange" />,
    color: 'orange'
  },
  {
    id: 'settings',
    title: 'Configurações de Afiliado',
    description: 'O primeiro passo é configurar suas IDs de Afiliado (Shopee, etc) na aba Afiliados. Sem isso, o motor não consegue gerar seus links proprietários.',
    icon: <Settings className="w-8 h-8 text-blue-400" />,
    color: 'blue'
  },
  {
    id: 'channels',
    title: 'Conectando Canais',
    description: 'Em "Canais", você conecta seus números de WhatsApp via Wasender ou bots de Telegram. É por aqui que o sinal de transmissão é emitido.',
    icon: <Smartphone className="w-8 h-8 text-emerald-400" />,
    color: 'emerald'
  },
  {
    id: 'groups',
    title: 'Grupos e Destinos',
    description: 'Após conectar um canal, sincronize seus grupos. Você pode criar "Listas de Destino" para agrupar múltiplos chats e disparar para todos de uma vez.',
    icon: <Users className="w-8 h-8 text-purple-400" />,
    color: 'purple'
  },
  {
    id: 'quick-send',
    title: 'Envio Rápido (Quick Send)',
    description: 'Encontrou uma oferta agora? Cole o link no Envio Rápido. O sistema extrai os dados, gera sua cópia e seu link de afiliado em segundos.',
    icon: <SendHorizonal className="w-8 h-8 text-kinetic-orange" />,
    color: 'orange'
  },
  {
    id: 'campaigns',
    title: 'Gestão de Campanhas',
    description: 'Planeje disparos em massa. Acompanhe o progresso de cada item do broadcast e garanta que todos os seus grupos recebam a oferta.',
    icon: <Calendar className="w-8 h-8 text-rose-400" />,
    color: 'rose'
  },
  {
    id: 'radar',
    title: 'Radar & Automação',
    description: 'Deixe a IA trabalhar por você. O Radar monitora ofertas em tempo real e você pode automatizar o processo de curadoria e envio.',
    icon: <Radar className="w-8 h-8 text-amber-400" />,
    color: 'amber'
  },
  {
    id: 'monitoring',
    title: 'Monitoramento M1',
    description: 'Acompanhe a integridade do motor e o status das filas de envio. Se algo falhar, você saberá exatamente onde e por quê.',
    icon: <Activity className="w-8 h-8 text-cyan-400" />,
    color: 'cyan'
  },
  {
    id: 'earnings',
    title: 'Painel de Ganhos',
    description: 'Visualize sua performance financeira. Comissões estimadas e métricas de conversão para otimizar sua estratégia de conteúdo.',
    icon: <TrendingUp className="w-8 h-8 text-emerald-500" />,
    color: 'emerald'
  },
  {
    id: 'reports',
    title: 'Relatórios de Auditoria',
    description: 'Dados profundos para decisões estratégicas. Analise o que mais vende e quais canais trazem o melhor retorno sobre o esforço.',
    icon: <BarChart3 className="w-8 h-8 text-indigo-400" />,
    color: 'indigo'
  }
];

// ─── Component ────────────────────────────────────────────────────────────────

interface OnboardingTutorialProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export default function OnboardingTutorial({ isOpen, onClose, userId }: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const supabase = createClient();

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleFinish = async () => {
    setIsFinishing(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { onboarding_completed: true }
      });

      if (error) throw error;
      
      toast.success('Onboarding concluído! Boas vendas.');
      onClose();
    } catch (err) {
      console.error('[ONBOARDING] Erro ao salvar progresso:', err);
      toast.error('Erro ao salvar seu progresso. Mas você já pode começar!');
      onClose();
    } finally {
      setIsFinishing(false);
    }
  };

  if (!isOpen) return null;

  const step = TUTORIAL_STEPS[currentStep];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      {/* Overlay Background */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-deep-void/90 backdrop-blur-md"
        onClick={() => {}} // Não fechar ao clicar fora para garantir a leitura
      />

      {/* Tutorial Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg z-[101]"
      >
        <TactileCard className="p-0 overflow-hidden border-none shadow-skeuo-elevated bg-gradient-to-br from-anthracite-surface to-deep-void">
          {/* Header with Progress */}
          <div className="h-1.5 w-full bg-white/5 relative">
            <motion.div 
              className="absolute h-full bg-kinetic-orange shadow-glow-orange"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / TUTORIAL_STEPS.length) * 100}%` }}
              transition={{ type: 'spring', damping: 20 }}
            />
          </div>

          <div className="p-8 md:p-10">
            {/* Step Counter */}
            <div className="flex items-center justify-between mb-8">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 italic">
                Missão de Integração • Step {currentStep + 1}/{TUTORIAL_STEPS.length}
              </span>
              <button 
                onClick={onClose}
                className="text-white/10 hover:text-white/40 transition-colors"
                aria-label="Pular tutorial"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Area */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center text-center"
              >
                <div className={cn(
                  "w-20 h-20 rounded-3xl mb-8 flex items-center justify-center shadow-skeuo-flat border border-white/5",
                  `bg-${step.color || 'kinetic'}-500/10`
                )}>
                  {step.icon}
                </div>

                <h2 className="text-2xl font-black uppercase tracking-tight font-headline italic mb-4 text-white/90">
                  {step.title}
                </h2>
                
                <p className="text-sm text-white/40 leading-relaxed font-medium max-w-[340px]">
                  {step.description}
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Actions */}
            <div className="mt-12 flex items-center justify-between gap-4">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={currentStep === 0}
                className="text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white/60 hover:bg-white/5 disabled:opacity-0 rounded-xl px-6"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-2" /> Voltar
              </Button>

              <KineticButton
                onClick={handleNext}
                disabled={isFinishing}
                className="h-14 flex-1 font-black uppercase tracking-[0.2em] text-[11px] font-headline italic rounded-2xl shadow-glow-orange-intense"
              >
                {currentStep === TUTORIAL_STEPS.length - 1 ? (
                  isFinishing ? 'Finalizando...' : 'Começar Operação 🚀'
                ) : (
                  <>
                    Próximo Passo <ChevronRight className="w-3.5 h-3.5 ml-2" />
                  </>
                )}
              </KineticButton>
            </div>

            {/* Skip Option */}
            {currentStep < TUTORIAL_STEPS.length - 1 && (
              <button 
                onClick={handleFinish}
                className="w-full mt-6 text-[9px] font-bold uppercase tracking-widest text-white/10 hover:text-white/30 transition-colors"
              >
                Pular tour e ir para o Dashboard
              </button>
            )}
          </div>
        </TactileCard>
      </motion.div>
    </div>
  );
}

// Sub-componentes do shadcn/ui necessários (ou adaptados)
function Button({ className, variant, ...props }: any) {
  return (
    <button 
      className={cn(
        "inline-flex items-center justify-center transition-colors focus-visible:outline-none disabled:pointer-events-none",
        variant === 'ghost' ? 'bg-transparent' : 'bg-white text-black',
        className
      )} 
      {...props} 
    />
  );
}
