// src/app/(dashboard)/envio-rapido/page.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { KineticButton } from '@/components/ui/KineticButton';
import { TactileCard } from '@/components/ui/TactileCard';
import { Button } from '@/components/ui/button';
import { 
  SendHorizonal, 
  ChevronLeft, 
  LayoutList, 
  Type, 
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Link2,
  Store,
  X,
  Edit2
} from 'lucide-react';
import { useDestinations } from '@/hooks/use-destinations';
import { useCreateCampaign } from '@/hooks/use-campaigns';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ProcessedProduct, processLinks } from '@/lib/linkProcessor';

// Opções de Tonalidade da IA (Base44)
const TONE_OPTIONS = [
  { value: 'auto', label: '✨ Automático', desc: 'IA adapta ao produto' },
  { value: 'vendedor', label: '🔥 Vendedor', desc: 'Urgência e conversão' },
  { value: 'divertido', label: '😄 Descontraído', desc: 'Leve e acessível' },
  { value: 'profissional', label: '💼 Profissional', desc: 'Sério e direto' },
  { value: 'natural', label: '🌿 Natural', desc: 'Conversa informal' },
];

export default function EnvioRapidoPage() {
  const { user } = useAuth();
  const { data: destinations, isLoading: loadingDestinations } = useDestinations(user?.id);
  const { mutate: createCampaign, isPending: isSending } = useCreateCampaign();
  const router = useRouter();

  // State Operacional (Base44 Flow)
  const [linksInput, setLinksInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedProducts, setProcessedProducts] = useState<ProcessedProduct[]>([]);
  const [tone, setTone] = useState('auto');
  const [generatedTexts, setGeneratedTexts] = useState<Record<string, string>>({});
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const linksCount = useMemo(() => linksInput.split('\n').filter(l => l.trim()).length, [linksInput]);

  // Gerar textos automaticamente ao processar produtos ou mudar o tom
  useEffect(() => {
    const newTexts: Record<string, string> = { ...generatedTexts };
    const toneLabel = TONE_OPTIONS.find(t => t.value === tone)?.label || 'Automático';
    
    processedProducts.forEach(p => {
      // Se não tem texto ainda ou o tom mudou, gera um novo
      if (!newTexts[p.id]) {
        newTexts[p.id] = `🔥 *OFERTA DETECTADA* [Tom: ${toneLabel}]\n\n*${p.name}*\n\n💰 De: ~~R$ ${p.originalPrice.toFixed(2)}~~\n✅ Por: *R$ ${p.currentPrice.toFixed(2)}*\n📉 *${p.discountPercent}% de DESCONTO!*\n\n🚀 Compre aqui: ${p.affiliateUrl}\n\n#oferta #promoção #${p.marketplace.toLowerCase()}`;
      }
    });
    setGeneratedTexts(newTexts);
  }, [processedProducts, tone]);

  const handleProcess = async () => {
    if (!linksInput.trim()) {
      toast.error('Cole pelo menos um link para processar.');
      return;
    }

    setIsProcessing(true);
    try {
      const links = linksInput.split('\n').filter(l => l.trim());
      const results = await processLinks(links);
      setProcessedProducts(results);
      toast.success(`${results.length} link(s) processado(s) com sucesso!`);
    } catch (error) {
      toast.error('Erro ao processar links. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleDestination = (id: string) => {
    setSelectedDestinations(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const handleSend = () => {
    if (selectedDestinations.length === 0) {
      toast.error('Selecione pelo menos uma lista de destino.');
      return;
    }

    const campaignData = {
      name: `Envio Rápido - ${new Date().toLocaleDateString()}`,
      items: processedProducts.map(p => ({
        product_id: p.id,
        product_name: p.name,
        custom_text: generatedTexts[p.id] || ''
      })),
      destinations: selectedDestinations.map(id => ({
        type: 'list' as const,
        id: id
      }))
    };

    createCampaign({ userId: user?.id as string, dto: campaignData }, {
      onSuccess: () => {
        setIsSuccess(true);
        toast.success('Campanha enviada com sucesso!');
      },
      onError: (error) => {
        console.error('Erro ao criar campanha:', error);
        toast.error('Erro ao realizar o envio.');
      }
    });
  };

  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-20 text-center animate-in zoom-in-95 duration-500">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 shadow-glow-orange/20">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </div>
        <h2 className="text-3xl font-black uppercase tracking-tight mb-2 font-headline">Transmissão Sincronizada!</h2>
        <p className="text-white/40 mb-8 max-w-sm mx-auto text-sm font-medium">
          Seus produtos foram processados e os registros de envio foram salvos com sucesso.
        </p>
        <div className="flex gap-4">
          <Button 
            variant="ghost" 
            className="font-black uppercase tracking-widest text-[10px] bg-white/5 rounded-xl px-8 h-12"
            onClick={() => {
              setIsSuccess(false);
              setProcessedProducts([]);
              setLinksInput('');
              setSelectedDestinations([]);
            }}
          >
            Novo Envio
          </Button>
          <KineticButton className="h-12 px-8" onClick={() => router.push('/campanhas')}>
            Ver Relatórios
          </KineticButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto pb-20">
      <PageHeader
        title="Envio Rápido"
        description="Core Operational Unit: Cole links, converta e dispare em segundos."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Lado Esquerdo: Input e Processamento */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* 1. Área de Links */}
          <TactileCard className="p-6 relative overflow-hidden group border-none">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-kinetic-orange/5 blur-3xl rounded-full pointer-events-none" />
            
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shadow-skeuo-flat group-hover:shadow-glow-orange/20 transition-all">
                  <Link2 className="w-4 h-4 text-kinetic-orange" />
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-sm uppercase tracking-widest font-headline">Entrada de Dados</span>
                  <span className="text-[10px] font-bold text-white/20 uppercase">Cole os links originais abaixo</span>
                </div>
              </div>
              <Badge variant="outline" className="bg-deep-void border-none shadow-skeuo-pressed text-[10px] font-black uppercase tracking-widest px-3 h-7">
                {linksCount} link(s) detectado(s)
              </Badge>
            </div>

            <Textarea 
              value={linksInput}
              onChange={(e) => setLinksInput(e.target.value)}
              placeholder={"https://shopee.com.br/produto-abc\nhttps://amazon.com.br/dp/B08X...\nhttps://produto.mercadolivre.com.br/..."}
              className="min-h-[140px] bg-deep-void shadow-skeuo-pressed border-none text-xs font-mono p-4 rounded-xl focus-visible:ring-1 focus-visible:ring-kinetic-orange/30 placeholder:text-white/10 resize-none leading-relaxed"
            />

            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2 text-[10px] font-bold text-white/20 uppercase tracking-tighter">
                <AlertCircle className="w-3 h-3" />
                Separe por uma linha para detecção automática
              </div>
              <KineticButton 
                onClick={handleProcess} 
                className="h-10 px-6 font-black text-[10px] uppercase tracking-widest"
                disabled={isProcessing || !linksInput.trim()}
              >
                {isProcessing ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Sincronizando...</>
                ) : (
                  <><Sparkles className="w-3.5 h-3.5 mr-2" /> Processar Links</>
                )}
              </KineticButton>
            </div>
          </TactileCard>

          {/* 2. Tonalidade da IA */}
          <TactileCard className="p-6 border-none">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shadow-skeuo-flat">
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-sm uppercase tracking-widest font-headline">Tonalidade da IA</span>
                <span className="text-[10px] font-bold text-white/20 uppercase">Ajuste o "Vibe" da conversão</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {TONE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTone(opt.value)}
                  className={cn(
                    "flex flex-col items-start p-3 rounded-2xl border-none transition-all w-[140px] text-left",
                    tone === opt.value 
                      ? "bg-kinetic-orange/10 shadow-skeuo-pressed ring-1 ring-kinetic-orange/50" 
                      : "bg-deep-void shadow-skeuo-pressed opacity-50 hover:opacity-80 active:scale-95"
                  )}
                >
                  <span className={cn(
                    "text-xs font-black uppercase tracking-widest mb-1",
                    tone === opt.value ? "text-kinetic-orange" : "text-white/40"
                  )}>
                    {opt.label.split(' ')[1]}
                  </span>
                  <span className="text-[10px] font-bold text-white/20 leading-tight">
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>
          </TactileCard>

          {/* 3. Produtos Processados */}
          {processedProducts.length > 0 && (
            <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-3 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/30 italic">
                Resultados do Processamento ({processedProducts.length})
              </div>
              {processedProducts.map((product) => (
                <TactileCard key={product.id} className="p-0 overflow-hidden border-none group">
                  <div className="flex flex-col md:flex-row">
                    {/* Imagem e Marketplace */}
                    <div className="w-full md:w-32 bg-deep-void/50 p-4 flex flex-col items-center justify-center gap-2 border-r border-white/5">
                      <div className="w-20 h-20 rounded-xl overflow-hidden shadow-skeuo-flat group-hover:shadow-glow-orange/10 transition-all duration-500">
                        <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                      <Badge variant="outline" className="bg-white/5 border-none text-[8px] font-black uppercase tracking-widest h-5 px-2">
                        {product.marketplace}
                      </Badge>
                    </div>

                    {/* Conteúdo e Texto */}
                    <div className="flex-1 p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex flex-col">
                          <h4 className="text-xs font-black uppercase tracking-widest text-white/90 line-clamp-1">{product.name}</h4>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] font-bold text-white/20 line-through">R$ {product.originalPrice.toFixed(2)}</span>
                            <span className="text-xs font-black text-kinetic-orange">R$ {product.currentPrice.toFixed(2)}</span>
                            <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-1.5 rounded">-{product.discountPercent}%</span>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 rounded-lg hover:bg-white/5 text-white/20 hover:text-white"
                          onClick={() => setEditingId(editingId === product.id ? null : product.id)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      <div className="relative">
                        <Textarea 
                          value={generatedTexts[product.id] || ''}
                          disabled={editingId !== product.id}
                          onChange={(e) => setGeneratedTexts(prev => ({ ...prev, [product.id]: e.target.value }))}
                          className={cn(
                            "min-h-[120px] text-[11px] font-mono leading-relaxed p-4 rounded-xl border-none transition-all resize-none",
                            editingId === product.id 
                              ? "bg-deep-void shadow-skeuo-pressed focus-visible:ring-1 focus-visible:ring-kinetic-orange/30 text-white/90" 
                              : "bg-black/20 text-white/40 cursor-not-allowed"
                          )}
                        />
                        {editingId === product.id && (
                          <div className="absolute top-2 right-2 flex gap-2">
                            <button 
                              onClick={() => setEditingId(null)}
                              className="px-2 py-1 bg-emerald-500 text-white text-[9px] font-black uppercase rounded shadow-lg animate-in zoom-in"
                            >
                              Salvar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </TactileCard>
              ))}
            </div>
          )}
        </div>

        {/* Lado Direito: Destinos e Resumo */}
        <div className="lg:col-span-5 space-y-8 flex flex-col">
          
          {/* 4. Destinos */}
          <TactileCard className="p-6 border-none">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shadow-skeuo-flat">
                <LayoutList className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-sm uppercase tracking-widest font-headline">Canais de Destino</span>
                <span className="text-[10px] font-bold text-white/20 uppercase">Onde a oferta será implantada</span>
              </div>
            </div>

            {loadingDestinations ? (
              <div className="flex flex-col items-center py-12 gap-3 opacity-20">
                <Loader2 className="w-6 h-6 text-kinetic-orange animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest">Acessando redes...</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                {destinations?.map((list) => (
                  <div 
                    key={list.id}
                    className={cn(
                      "flex items-center space-x-3 p-4 rounded-2xl border-none transition-all cursor-pointer",
                      selectedDestinations.includes(list.id) 
                        ? "bg-kinetic-orange/10 shadow-skeuo-pressed" 
                        : "bg-deep-void shadow-skeuo-pressed opacity-50 hover:opacity-80"
                    )}
                    onClick={() => handleToggleDestination(list.id)}
                  >
                    <Checkbox 
                      checked={selectedDestinations.includes(list.id)}
                      className="border-white/10 data-[state=checked]:bg-kinetic-orange data-[state=checked]:border-none"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black uppercase tracking-widest text-white/90">{list.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                         <span className="text-[9px] text-white/20 font-bold uppercase">
                            Integrado • 3 Grupos
                         </span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-white/5 border-none text-[8px] font-black uppercase text-white/40 h-5">
                      telegram
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </TactileCard>

          {/* 5. Resumo e Envio */}
          <TactileCard className="p-8 border-none ring-1 ring-kinetic-orange/20 bg-gradient-to-br from-anthracite-surface to-deep-void shadow-skeuo-elevated sticky top-24">
            <h3 className="text-xs font-black uppercase tracking-widest text-kinetic-orange mb-6 font-headline">Sumário Operacional</h3>
            
            <div className="space-y-5 mb-8">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-white/30 font-bold uppercase">Cargas de Produto:</span>
                <span className="font-black text-white/80">{processedProducts.length}</span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-white/30 font-bold uppercase">Vetores de Destino:</span>
                <span className="font-black text-white/80">{selectedDestinations.length}</span>
              </div>
              <div className="h-px bg-white/5 w-full my-2" />
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/50 font-black uppercase tracking-widest">Total de Transmissões:</span>
                <span className="font-black text-kinetic-orange text-lg shadow-glow-orange/20">{processedProducts.length * selectedDestinations.length}</span>
              </div>
            </div>

            <KineticButton 
              className="w-full h-14 font-black uppercase tracking-widest text-sm shadow-xl hover:scale-[1.02] transition-transform"
              disabled={isSending || processedProducts.length === 0 || selectedDestinations.length === 0}
              onClick={handleSend}
            >
              {isSending ? (
                <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Transmitindo...</>
              ) : (
                <><SendHorizonal className="w-4 h-4 mr-3" /> Iniciar Broadcast</>
              )}
            </KineticButton>

            <div className="mt-6 flex items-start gap-3 p-4 bg-deep-void/50 rounded-xl border-none shadow-skeuo-pressed">
               <AlertCircle className="w-4 h-4 text-kinetic-orange flex-shrink-0 mt-0.5" />
               <p className="text-[9px] font-bold leading-relaxed uppercase text-white/30">
                 ALERTA: A transmissão real depende das APIs externas. No modo atual, os registros são persistidos no Supabase.
               </p>
            </div>
          </TactileCard>
        </div>
      </div>
    </div>
  );
}
