'use client';

import React, { useState, useEffect, useMemo } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { KineticButton } from '@/components/ui/KineticButton';
import { TactileCard } from '@/components/ui/TactileCard';
import { Button } from '@/components/ui/button';
import {
  SendHorizonal,
  LayoutList,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Link2,
  Edit2,
  Info,
  Copy,
  Check
} from 'lucide-react';
import { useDestinations } from '@/hooks/use-destinations';
import { useChannels } from '@/hooks/use-channels';
import { useCreateCampaign } from '@/hooks/use-campaigns';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ProductSnapshot } from '@/lib/linkProcessor';

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

  const [linksInput, setLinksInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedProducts, setProcessedProducts] = useState<ProductSnapshot[]>([]);
  const [tone, setTone] = useState('auto');
  // generatedTexts removido: agora usamos o campo messageText dentro do snapshot
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);
  const [isSuccess, setIsSuccess] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: channels, isLoading: loadingChannels } = useChannels(user?.id);
  const [testChannelId, setTestChannelId] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Oi, este é um teste do motor M1 SYNCO! 🚀');
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (channels && channels.length > 0 && !testChannelId) {
      setTestChannelId(channels[0].id);
    }
  }, [channels, testChannelId]);

  const selectedChannel = useMemo(
    () => channels?.find(c => c.id === testChannelId),
    [channels, testChannelId]
  );
  const selectedChannelType = selectedChannel?.type || 'whatsapp';

  const linksCount = useMemo(
    () => linksInput.split('\n').filter(l => l.trim()).length,
    [linksInput]
  );

  const handleTestSend = async () => {
    if (!testChannelId || !testPhone || !testMessage) {
      toast.error('Preencha os campos obrigatórios do teste.');
      return;
    }

    setIsTesting(true);
    toast.info('Iniciando requisição para API...');

    try {
      let apiUrl: string;
      let body: Record<string, string>;

      if (selectedChannelType === 'telegram') {
        apiUrl = '/api/telegram/send-test';
        body = { channelId: testChannelId, chatId: testPhone, message: testMessage };
      } else {
        apiUrl = '/api/wa/send-test';
        body = { channelId: testChannelId, phone: testPhone, message: testMessage };
      }

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const text = await res.text();
      let data: any;

      try {
        data = JSON.parse(text);
      } catch {
        alert('ERRO CRÍTICO DO SERVIDOR:\n' + text.substring(0, 200));
        toast.error('O Servidor retornou um erro não interpretável (verifique o log)');
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao enviar via API');
      }

      const platformName = selectedChannelType === 'telegram' ? 'Telegram' : 'Wasender';
      alert(`SUCESSO! O ${platformName} aceitou a mensagem.\nRetorno: ` + JSON.stringify(data.response).substring(0, 100));
      toast.success('Envio direto disparado com sucesso!');
    } catch (e: any) {
      alert('ERRO CATCH:\n' + (e.message || String(e)));
      toast.error(e.message || String(e));
    } finally {
      setIsTesting(false);
    }
  };

  const handleProcess = async () => {
    if (!linksInput.trim()) {
      toast.error('Cole pelo menos um link para processar.');
      return;
    }

    setIsProcessing(true);

    try {
      const links = linksInput.split('\n').filter(l => l.trim());
      const res = await fetch('/api/links/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links, tone })
      });

      if (!res.ok) {
        throw new Error('Falha na API de processamento');
      }

      const data = await res.json();
      setProcessedProducts(data.results);
      toast.success(`${data.results.length} link(s) processado(s) com sucesso!`);
    } catch (error) {
      console.error('Process error:', error);
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
        product_name: p.factual.title,
        custom_text: p.copy.messageText || '',
        image_url: p.factual.image || undefined,
        affiliate_url: p.factual.finalLinkToSend
      })),
      destinations: selectedDestinations.map(id => ({
        type: 'list' as const,
        id
      }))
    };

    createCampaign(
      { userId: user?.id as string, dto: campaignData },
      {
        onSuccess: () => {
          setIsSuccess(true);
          toast.success('Campanha enviada com sucesso!');
        },
        onError: error => {
          console.error('Erro ao criar campanha:', error);
          toast.error('Erro ao realizar o envio.');
        }
      }
    );
  };

  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-20 text-center animate-in zoom-in-95 duration-500">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 shadow-glow-orange/20">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </div>
        <h2 className="text-3xl font-black uppercase tracking-tight mb-2 font-headline">
          Transmissão Sincronizada!
        </h2>
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

      <Tabs defaultValue="broadcast" className="w-full">
        <TabsList className="mb-8 bg-deep-void shadow-skeuo-pressed border p-1 rounded-xl">
          <TabsTrigger
            value="broadcast"
            className="text-xs font-black uppercase tracking-widest px-6 data-[state=active]:bg-kinetic-orange/10 data-[state=active]:text-kinetic-orange"
          >
            🚀 Envio em Massa (Grupos)
          </TabsTrigger>
          <TabsTrigger
            value="test"
            className="text-xs font-black uppercase tracking-widest px-6 data-[state=active]:bg-kinetic-orange/10 data-[state=active]:text-kinetic-orange"
          >
            🔬 Teste de Conexão
          </TabsTrigger>
        </TabsList>

        <TabsContent value="broadcast" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-8">
              <TactileCard className="p-6 relative overflow-hidden group border-none">
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-kinetic-orange/5 blur-3xl rounded-full pointer-events-none" />

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shadow-skeuo-flat group-hover:shadow-glow-orange/20 transition-all">
                      <Link2 className="w-4 h-4 text-kinetic-orange" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-black text-sm uppercase tracking-widest font-headline">
                        Entrada de Dados
                      </span>
                      <span className="text-[10px] font-bold text-white/20 uppercase">
                        Cole os links originais abaixo
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-deep-void border-none shadow-skeuo-pressed text-[10px] font-black uppercase tracking-widest px-3 h-7"
                  >
                    {linksCount} link(s) detectado(s)
                  </Badge>
                </div>

                <Textarea
                  value={linksInput}
                  onChange={e => setLinksInput(e.target.value)}
                  placeholder={
                    'https://shopee.com.br/produto-abc\nhttps://amazon.com.br/dp/B08X...\nhttps://produto.mercadolivre.com.br/...'
                  }
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
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Sincronizando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 mr-2" /> Processar Links
                      </>
                    )}
                  </KineticButton>
                </div>
              </TactileCard>

              <TactileCard className="p-6 border-none">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shadow-skeuo-flat">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-sm uppercase tracking-widest font-headline">
                      Tonalidade da IA
                    </span>
                    <span className="text-[10px] font-bold text-white/20 uppercase">
                      Ajuste o "Vibe" da conversão
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {TONE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setTone(opt.value)}
                      className={cn(
                        'flex flex-col items-start p-3 rounded-2xl border-none transition-all w-[140px] text-left',
                        tone === opt.value
                          ? 'bg-kinetic-orange/10 shadow-skeuo-pressed ring-1 ring-kinetic-orange/50'
                          : 'bg-deep-void shadow-skeuo-pressed opacity-50 hover:opacity-80 active:scale-95'
                      )}
                    >
                      <span
                        className={cn(
                          'text-xs font-black uppercase tracking-widest mb-1',
                          tone === opt.value ? 'text-kinetic-orange' : 'text-white/40'
                        )}
                      >
                        {opt.label.split(' ')[1]}
                      </span>
                      <span className="text-[10px] font-bold text-white/20 leading-tight">
                        {opt.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </TactileCard>

              {processedProducts.length > 0 && (
                <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-3 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/30 italic">
                    Resultados Operacionais ({processedProducts.length})
                  </div>

                  {processedProducts.map(product => (
                    <TactileCard key={product.id} className="p-0 overflow-hidden border-none group">
                      <div className="flex flex-col md:flex-row">
                        <div className="w-full md:w-32 bg-deep-void/50 p-4 flex flex-col items-center justify-center border-r border-white/5 bg-gradient-to-b from-transparent to-white/5">
                          <div className="w-20 h-20 rounded-xl overflow-hidden shadow-skeuo-flat group-hover:shadow-glow-orange/20 transition-all duration-500 bg-deep-void relative">
                            {product.metadata.source === 'fallback' || !product.factual.image ? (
                              <div className="flex flex-col items-center justify-center h-full bg-anthracite-surface/40 border border-white/5 rounded-xl">
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mb-1.5 shadow-skeuo-pressed">
                                  <Info className="w-3.5 h-3.5 text-white/20" />
                                </div>
                                <span className="text-[8px] font-black uppercase tracking-widest text-white/30 text-center px-1">
                                  Img Indisponível
                                </span>
                              </div>
                            ) : (
                                <img
                                  src={product.factual.image}
                                  alt=""
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                />
                            )}
                            <div className="absolute top-1 right-1">
                              <Badge
                                variant="outline"
                                className="bg-black/60 backdrop-blur-md border-none text-[7px] font-black uppercase tracking-tighter h-4 px-1.5"
                              >
                                {product.factual.marketplace}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="flex-1 p-5 lg:p-6 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2 group/title">
                                  <h4 className="text-[13px] font-black uppercase tracking-wider text-white/90 line-clamp-1 font-headline group-hover:text-kinetic-orange transition-colors inline-block">
                                    {product.factual.title}
                                  </h4>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 rounded-md bg-white/5 hover:bg-kinetic-orange/10 hover:text-kinetic-orange flex items-center gap-1.5 transition-all opacity-0 group-hover/title:opacity-100"
                                    onClick={() => {
                                      navigator.clipboard.writeText(product.factual.finalLinkToSend);
                                      toast.success('Link copiado!');
                                    }}
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span className="text-[8px] font-black uppercase tracking-widest">Link</span>
                                  </Button>
                                </div>

                              <div className="flex flex-wrap items-center gap-3">
                                {product.metadata.source !== 'fallback' && product.factual.price && product.factual.price > 0 ? (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <div className="flex flex-col items-start gap-1 cursor-pointer group/price hover:bg-white/5 px-2 -ml-2 py-1 rounded-xl transition-all">
                                        <div className="flex items-center gap-2">
                                          {product.factual.originalPrice && product.factual.originalPrice > product.factual.currentPriceFactual! && (
                                            <span className="text-[10px] line-through text-white/20 font-bold decoration-kinetic-orange/40">
                                              {product.factual.originalPriceFormatted}
                                            </span>
                                          )}
                                          <span className="text-[14px] font-black text-kinetic-orange shadow-glow-orange/10">
                                            {product.factual.priceFormatted || 'Preço Indisponível'}
                                          </span>
                                          <Info className="w-3 h-3 text-white/20 group-hover/price:text-kinetic-orange transition-colors" />
                                        </div>
                                        
                                        {product.factual.estimatedPixPrice && (
                                          <div className="flex items-center gap-1.5 bg-kinetic-orange/5 px-1.5 py-0.5 rounded-md border border-kinetic-orange/10">
                                            <span className="text-[9px] font-black text-kinetic-orange/80 uppercase">
                                              {product.factual.estimatedPixPriceFormatted}
                                            </span>
                                            <span className="text-[8px] font-bold text-white/40 uppercase tracking-tighter">
                                              No Pix
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 bg-deep-void border-none shadow-skeuo-elevated p-5 animate-in fade-in zoom-in duration-200 rounded-2xl ring-1 ring-white/5">
                                      <div className="space-y-4">
                                        <h5 className="text-[10px] font-black uppercase tracking-widest text-white/30 border-b border-white/5 pb-2">
                                          Auditoria Factual Pro
                                        </h5>
                                        
                                        <div className="space-y-2.5 text-[11px] font-bold text-white/40">
                                            <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
                                              <span className="text-[9px] uppercase">Fonte do Preço</span>
                                              <Badge variant="outline" className="h-4 text-[8px] border-none bg-deep-void uppercase">{product.factual.currentPriceSource || 'N/A'}</Badge>
                                            </div>
                                            <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg">
                                              <span className="text-[9px] uppercase">Fonte Comissão</span>
                                              <Badge variant="outline" className="h-4 text-[8px] border-none bg-deep-void uppercase">{product.factual.commissionSource || 'N/A'}</Badge>
                                            </div>
                                            
                                            <div className="h-px bg-white/5 my-1" />
                                            
                                            <div className="flex justify-between items-baseline pt-1">
                                              <span className="text-[9px] uppercase text-white/20 font-black">Preço API</span>
                                              <span className="text-white/80">{product.factual.priceFormatted}</span>
                                            </div>
                                            
                                            {product.factual.estimatedPixPrice && (
                                              <div className="flex justify-between items-baseline">
                                                <span className="text-[9px] uppercase text-kinetic-orange/40 font-black">No Pix</span>
                                                <span className="text-kinetic-orange/80">{product.factual.estimatedPixPriceFormatted}</span>
                                              </div>
                                            )}

                                            <div className="flex justify-between items-baseline pt-2 border-t border-white/5 text-kinetic-orange text-[12px] font-black">
                                              <span>COMISSÃO FINAL</span>
                                              <span>{product.factual.commissionValueFormatted || 'R$ 0,00'}</span>
                                            </div>
                                        </div>
                                        
                                        <p className="text-[8px] text-white/10 font-black uppercase tracking-tight text-center pt-2 italic">
                                          Telemetry ID: {product.factual.itemId} • {new Date(product.factual.fetchedAt).toLocaleString('pt-BR')}
                                        </p>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                ) : (
                                  <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest bg-white/5 px-2 py-1 rounded-lg">
                                    Preço sob consulta
                                  </span>
                                )}

                                <Badge
                                  variant="outline"
                                  className="bg-kinetic-orange/10 text-kinetic-orange border border-kinetic-orange/20 px-2 h-5 text-[8px] font-black uppercase tracking-widest shadow-glow-orange/5"
                                >
                                  Tracking Oficial Ativo
                                </Badge>

                                {product.factual.commissionValueFactual && product.factual.commissionValueFactual > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 h-5 text-[8px] font-black uppercase tracking-widest"
                                  >
                                    💰 {product.factual.commissionValueFormatted} 
                                    {product.factual.commissionRatePercent && (
                                      <span className="ml-1 opacity-60 font-bold">({product.factual.commissionRatePercent})</span>
                                    )}
                                    <span className="ml-1">comissão</span>
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-lg bg-white/5 hover:bg-kinetic-orange/10 hover:text-kinetic-orange transition-colors"
                              onClick={() => setEditingId(editingId === product.id ? null : product.id)}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>

                          <div className="relative">
                            <Textarea
                              value={product.copy.messageText || ''}
                              disabled={editingId !== product.id}
                              onChange={e =>
                                setProcessedProducts(prev => 
                                  prev.map(p => p.id === product.id 
                                    ? { ...p, copy: { ...p.copy, messageText: e.target.value } } 
                                    : p
                                  )
                                )
                              }
                              className={cn(
                                'min-h-[120px] text-[11px] font-mono leading-relaxed p-4 rounded-xl border-none transition-all resize-none',
                                editingId === product.id
                                  ? 'bg-deep-void shadow-skeuo-pressed focus-visible:ring-1 focus-visible:ring-kinetic-orange/30 text-white/90'
                                  : 'bg-black/20 text-white/40 cursor-not-allowed'
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

            <div className="lg:col-span-5 space-y-8 flex flex-col">
              <TactileCard className="p-6 border-none">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shadow-skeuo-flat">
                    <LayoutList className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-sm uppercase tracking-widest font-headline">
                      Canais de Destino
                    </span>
                    <span className="text-[10px] font-bold text-white/20 uppercase">
                      Onde a oferta será implantada
                    </span>
                  </div>
                </div>

                {loadingDestinations ? (
                  <div className="flex flex-col items-center py-12 gap-3 opacity-20">
                    <Loader2 className="w-6 h-6 text-kinetic-orange animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      Acessando redes...
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                    {destinations?.map(list => (
                      <div
                        key={list.id}
                        className={cn(
                          'flex items-center space-x-3 p-4 rounded-2xl border-none transition-all cursor-pointer',
                          selectedDestinations.includes(list.id)
                            ? 'bg-kinetic-orange/10 shadow-skeuo-pressed'
                            : 'bg-deep-void shadow-skeuo-pressed opacity-50 hover:opacity-80'
                        )}
                        onClick={() => handleToggleDestination(list.id)}
                      >
                        <Checkbox
                          checked={selectedDestinations.includes(list.id)}
                          className="border-white/10 data-[state=checked]:bg-kinetic-orange data-[state=checked]:border-none"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black uppercase tracking-widest text-white/90">
                            {list.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] text-white/20 font-bold uppercase">
                              Integrado • Ativo
                            </span>
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className="bg-white/5 border-none text-[8px] font-black uppercase text-white/40 h-5"
                        >
                          Remoto
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TactileCard>

              <TactileCard className="p-8 border-none ring-1 ring-kinetic-orange/20 bg-gradient-to-br from-anthracite-surface to-deep-void shadow-skeuo-elevated sticky top-24">
                <h3 className="text-xs font-black uppercase tracking-widest text-kinetic-orange mb-6 font-headline">
                  Sumário Operacional
                </h3>

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
                    <span className="text-white/50 font-black uppercase tracking-widest">
                      Total de Transmissões:
                    </span>
                    <span className="font-black text-kinetic-orange text-lg shadow-glow-orange/20">
                      {processedProducts.length * selectedDestinations.length}
                    </span>
                  </div>
                </div>

                <KineticButton
                  className="w-full h-14 font-black uppercase tracking-widest text-sm shadow-xl hover:scale-[1.02] transition-transform"
                  disabled={
                    isSending || processedProducts.length === 0 || selectedDestinations.length === 0
                  }
                  onClick={handleSend}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-3 animate-spin" /> Transmitindo...
                    </>
                  ) : (
                    <>
                      <SendHorizonal className="w-4 h-4 mr-3" /> Iniciar Broadcast
                    </>
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
        </TabsContent>

        <TabsContent value="test" className="mt-0">
          <TactileCard className="p-8 max-w-2xl mx-auto border-none ring-1 ring-white/5 space-y-6">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <SendHorizonal className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-black uppercase tracking-widest text-sm">Disparo Imediato</h3>
                <p className="text-[10px] uppercase text-white/40 font-bold">
                  Teste a conexão enviando para si mesmo
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-2 block">
                  Canal de Disparo (Remetente)
                </label>
                {loadingChannels ? (
                  <div className="text-xs font-bold text-white/30 uppercase">
                    Carregando canais...
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {channels?.map(c => (
                      <div
                        key={c.id}
                        onClick={() => setTestChannelId(c.id)}
                        className={cn(
                          'p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all',
                          testChannelId === c.id
                            ? 'bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500'
                            : 'bg-deep-void border-white/5 hover:border-white/20'
                        )}
                      >
                        <div
                          className={cn(
                            'w-2 h-2 rounded-full shadow-[0_0_10px]',
                            c.config?.status === 'connected'
                              ? 'bg-emerald-500 shadow-emerald-500/50'
                              : 'bg-white/20 shadow-white/10'
                          )}
                        />
                        <span className="text-xs font-bold">{c.name}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'ml-auto border-none text-[8px] font-black uppercase tracking-widest h-5 px-2',
                            c.type === 'telegram'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-emerald-500/10 text-emerald-400'
                          )}
                        >
                          {c.type === 'telegram' ? '🤖 Telegram' : '📱 WhatsApp'}
                        </Badge>
                      </div>
                    ))}
                    {(!channels || channels.length === 0) && (
                      <div className="text-xs font-bold text-destructive uppercase">
                        Nenhum canal conectado!
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-2 block">
                  {selectedChannelType === 'telegram'
                    ? 'Chat ID do Destinatário'
                    : 'Número do Destinatário'}
                </label>
                <Input
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  placeholder={
                    selectedChannelType === 'telegram'
                      ? 'Ex: -1001234567890 ou 123456789'
                      : 'Ex: +5547990000000'
                  }
                  className="bg-deep-void border-none shadow-skeuo-pressed font-mono text-sm"
                />
                {selectedChannelType === 'telegram' && (
                  <p className="text-[9px] text-white/20 font-bold mt-1.5 uppercase tracking-tight">
                    💡 Para grupos, use o ID numérico negativo. Ex: -1001234567890
                  </p>
                )}
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-2 block">
                  Mensagem Experimental
                </label>
                <Textarea
                  value={testMessage}
                  onChange={e => setTestMessage(e.target.value)}
                  className="bg-deep-void border-none shadow-skeuo-pressed min-h-[100px] text-sm"
                />
              </div>

              <KineticButton
                className="w-full h-12 uppercase font-black tracking-widest text-xs mt-4 bg-kinetic-orange hover:bg-kinetic-orange/90 text-black shadow-glow-orange/30"
                onClick={handleTestSend}
                disabled={isTesting || !testChannelId || !testPhone || !testMessage}
              >
                {isTesting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <SendHorizonal className="w-4 h-4 mr-2" />
                )}
                {isTesting ? 'Transmitindo...' : 'Fogo (Enviar Teste)'}
              </KineticButton>
            </div>
          </TactileCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}