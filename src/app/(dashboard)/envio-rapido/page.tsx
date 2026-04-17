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
import { useGroups, useDestinations } from '@/hooks/use-destinations';
import { SaveListDialog } from '@/components/destinations/SaveListDialog';
import { DestinationList } from '@/types/destination-list';
import { Group } from '@/types/group';
import { useChannels } from '@/hooks/use-channels';
import { useCreateCampaign } from '@/hooks/use-campaigns';
import { BroadcastMonitor } from '@/components/campaigns/broadcast-monitor';
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
import LayoutContainer from '@/components/layout/LayoutContainer';
import { Zap } from 'lucide-react';

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
  const { data: groups, isLoading: loadingDestinations } = useGroups(user?.id);
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
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [isSaveListOpen, setIsSaveListOpen] = useState(false);

  const { data: savedLists, isLoading: loadingLists } = useDestinations(user?.id);

  const { data: channels, isLoading: loadingChannels } = useChannels(user?.id);
  const [testChannelId, setTestChannelId] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Oi, este é um teste do motor M1 SYNCO! 🚀');
  const [isTesting, setIsTesting] = useState(false);
  const [lastApiResponse, setLastApiResponse] = useState<any>(null);
  const [testGroupId, setTestGroupId] = useState('');

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

  const groupedDestinations = useMemo(() => {
    if (!groups) return {};
    return groups.reduce((acc, group) => {
      const channelId = group.channel_id;
      if (!acc[channelId]) {
        acc[channelId] = {
          name: group.channel_name || 'Desconhecido',
          phone: group.channel_config?.phoneNumber || null,
          groups: []
        };
      }
      acc[channelId].groups.push(group);
      return acc;
    }, {} as Record<string, { name: string; phone: string | null; groups: Group[] }>);
  }, [groups]);

  // Grupos filtrados para a aba de teste
  const availableTestGroups = useMemo(() => {
    if (!testChannelId || !groupedDestinations[testChannelId]) return [];
    return groupedDestinations[testChannelId].groups;
  }, [testChannelId, groupedDestinations]);

  const handleTestSend = async () => {
    // Para WhatsApp, aceitamos testGroupId OU testPhone. Para Telegram, usamos testPhone (chatId).
    const effectiveTarget = selectedChannelType === 'whatsapp' ? (testGroupId || testPhone) : testPhone;

    if (!testChannelId || !effectiveTarget || !testMessage) {
      toast.error('Preencha os campos obrigatórios do teste.');
      return;
    }

    setIsTesting(true);
    setLastApiResponse(null);
    toast.info('Iniciando requisição para API...');

    try {
      let apiUrl: string;
      let body: Record<string, string>;

      if (selectedChannelType === 'telegram') {
        apiUrl = '/api/telegram/send-test';
        body = { channelId: testChannelId, chatId: effectiveTarget, message: testMessage };
      } else {
        apiUrl = '/api/wasender/test-send';
        body = { channelId: testChannelId, phone: effectiveTarget, message: testMessage };
      }

      console.log(`[ENVIO-TESTE] Request:`, body);

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
        console.error('ERRO CRÍTICO DO SERVIDOR:', text);
        setLastApiResponse({ rawResponse: text, error: 'Resposta não J-SON' });
        toast.error('O Servidor retornou um erro não interpretável.');
        return;
      }

      setLastApiResponse(data);

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao enviar via API');
      }

      toast.success('Envio direto disparado com sucesso!');
    } catch (e: any) {
      console.error('ERRO CATCH:', e);
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

  const handleToggleList = (list: DestinationList) => {
    const listGroupIds = list.group_ids || [];
    if (listGroupIds.length === 0) return;

    const areAllSelected = listGroupIds.every(id => selectedDestinations.includes(id));

    if (areAllSelected) {
      // Remover todos os grupos desta lista
      setSelectedDestinations(prev => prev.filter(id => !listGroupIds.includes(id)));
    } else {
      // Adicionar apenas os que faltam
      setSelectedDestinations(prev => [...new Set([...prev, ...listGroupIds])]);
    }
  };

  const getListStats = (list: DestinationList) => {
    const total = list.group_ids?.length || 0;
    const selected = list.group_ids?.filter(id => selectedDestinations.includes(id)).length || 0;
    return {
      total,
      selected,
      isAll: total > 0 && total === selected,
      isPartial: selected > 0 && selected < total
    };
  };

  const handleSend = () => {
    if (selectedDestinations.length === 0) {
      toast.error('Selecione pelo menos um grupo de destino.');
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
        id,
        type: 'group' as const,
      }))
    };

    createCampaign(
      { userId: user?.id as string, dto: campaignData },
      {
        onSuccess: (data) => {
          setIsSuccess(true);
          setActiveCampaignId(data.id);
          toast.success(`Broadcasting iniciado: ${data.id.slice(0, 8)}`);
        },
        onError: error => {
          console.error('Erro ao criar campanha:', error);
          toast.error('Erro ao realizar o envio.');
        }
      }
    );
  };


  return (
    <LayoutContainer type="operational">
      <PageHeader
        title="Envio Rápido"
        description="Core Operational Unit: Extração, Gestão e Broadcast Multiponto."
        icon={<Zap size={24} />}
      />

      <Tabs defaultValue="broadcast" className="w-full">
        <TabsList className="mb-6 bg-deep-void/50 shadow-skeuo-pressed p-1 rounded-2xl border-none h-12">
          <TabsTrigger
            value="broadcast"
            className="text-[10px] font-black uppercase tracking-[0.2em] px-8 h-full rounded-xl data-[state=active]:bg-kinetic-orange/10 data-[state=active]:text-kinetic-orange data-[state=active]:shadow-skeuo-pressed font-headline italic"
          >
            🚀 Broadcast Operacional
          </TabsTrigger>
          <TabsTrigger
            value="test"
            className="text-[10px] font-black uppercase tracking-[0.2em] px-8 h-full rounded-xl data-[state=active]:bg-kinetic-orange/10 data-[state=active]:text-kinetic-orange data-[state=active]:shadow-skeuo-pressed font-headline italic"
          >
            🔬 Telemetria / Teste
          </TabsTrigger>
        </TabsList>

        <TabsContent value="broadcast" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-8">
              <TactileCard className="p-6 relative overflow-hidden group border-none">
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-kinetic-orange/5 blur-3xl rounded-full pointer-events-none" />

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shadow-skeuo-flat group-hover:shadow-glow-orange/20 transition-all border border-white/5">
                      <Link2 className="w-4 h-4 text-kinetic-orange" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-black text-[11px] uppercase tracking-[0.2em] font-headline italic text-white/90">
                        Entrada de Links
                      </span>
                      <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                        Protocolo de Extração Factual
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

                <div className="flex items-center justify-between mt-5">
                  <div className="flex items-center gap-2.5 text-[9px] font-bold text-white/10 uppercase tracking-widest italic">
                    <AlertCircle className="w-3 h-3" />
                    Separação por linha para detecção múltipla
                  </div>
                  <KineticButton
                    onClick={handleProcess}
                    className="h-11 px-8 font-black text-[10px] uppercase tracking-[0.2em] rounded-xl"
                    disabled={isProcessing || !linksInput.trim()}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Sincronizando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 mr-2" /> Iniciar Extração
                      </>
                    )}
                  </KineticButton>
                </div>
              </TactileCard>

              {/* Vibe Engine (IA) Oculto por decisão de produto: Envio Rápido 100% Determinístico */}
              {false && (
                <TactileCard className="p-6 border-none">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center shadow-skeuo-flat border border-purple-500/20">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-black text-[11px] uppercase tracking-[0.2em] font-headline italic text-white/90">
                        Vibe Engine (IA)
                      </span>
                      <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                        Personalização de Tonalidade Operacional
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {TONE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setTone(opt.value)}
                        className={cn(
                          'flex flex-col items-start p-3 rounded-2xl border-none transition-all w-[140px] text-left relative overflow-hidden group',
                          tone === opt.value
                            ? 'bg-kinetic-orange/10 shadow-skeuo-pressed ring-1 ring-kinetic-orange/40'
                            : 'bg-deep-void shadow-skeuo-pressed opacity-50 hover:opacity-80 active:scale-95'
                        )}
                      >
                        {tone === opt.value && (
                          <div className="absolute top-0 right-0 w-8 h-8 bg-kinetic-orange/20 blur-xl rounded-full" />
                        )}
                        <span
                          className={cn(
                            'text-[10px] font-black uppercase tracking-[0.2em] mb-1 font-headline italic',
                            tone === opt.value ? 'text-kinetic-orange' : 'text-white/40'
                          )}
                        >
                          {opt.label.split(' ')[1]}
                        </span>
                        <span className="text-[9px] font-bold text-white/20 leading-tight uppercase tracking-tighter">
                          {opt.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </TactileCard>
              )}

              {processedProducts.length > 0 && (
                <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-3 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/30 italic">
                    Resultados Operacionais ({processedProducts.length})
                  </div>

                  {processedProducts.map(product => (
                    <TactileCard key={product.id} className="p-0 overflow-hidden border-none group">
                      <div className="flex flex-col md:flex-row">
                        <div className="w-full md:w-36 bg-deep-void/50 p-4 flex flex-col items-center justify-center border-r border-white/5 bg-gradient-to-b from-transparent to-white/5 shrink-0">
                          <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-skeuo-flat group-hover:shadow-glow-orange/20 transition-all duration-500 bg-deep-void relative border border-white/5">
                            {product.metadata.source === 'fallback' || !product.factual.image ? (
                              <div className="flex flex-col items-center justify-center h-full bg-anthracite-surface/40 rounded-xl">
                                <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center mb-1.5 shadow-skeuo-pressed">
                                  <Info className="w-4 h-4 text-white/10" />
                                </div>
                                <span className="text-[7.5px] font-black uppercase tracking-widest text-white/20 text-center px-2 leading-tight">
                                  SINAL DE IMAGEM AUSENTE
                                </span>
                              </div>
                            ) : (
                                <img
                                  src={product.factual.image}
                                  alt=""
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                />
                            )}
                            <div className="absolute top-1.5 right-1.5">
                              <Badge
                                variant="outline"
                                className="bg-black/80 backdrop-blur-md border border-white/10 text-[7px] font-black uppercase tracking-tighter h-4 px-1.5 rounded-md"
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
                                  <h4 className="text-[14px] font-black uppercase tracking-tight text-white/90 line-clamp-1 font-headline italic group-hover:text-kinetic-orange transition-colors">
                                    {product.factual.title}
                                  </h4>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-3 rounded-lg bg-white/5 hover:bg-kinetic-orange/20 hover:text-kinetic-orange flex items-center gap-2 transition-all opacity-0 group-hover/title:opacity-100 border border-white/5"
                                    onClick={() => {
                                      navigator.clipboard.writeText(product.factual.finalLinkToSend);
                                      toast.success('Link original copiado para a área de transferência');
                                    }}
                                  >
                                    <Copy className="w-3 h-3 text-kinetic-orange" />
                                    <span className="text-[8px] font-black uppercase tracking-widest">COPIAR LINK</span>
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
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shadow-skeuo-flat border border-blue-500/20">
                      <LayoutList className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-black text-[11px] uppercase tracking-[0.2em] font-headline italic text-white/90">
                        Estrutura de Destino
                      </span>
                      <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                        Vetores de Propagação Multiponto
                      </span>
                    </div>
                  </div>

                  {selectedDestinations.length > 1 && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setIsSaveListOpen(true)}
                      className="h-8 px-3 bg-kinetic-orange/10 hover:bg-kinetic-orange/20 text-kinetic-orange border-none text-[9px] font-black uppercase tracking-widest gap-2 rounded-lg transition-all"
                    >
                      <Sparkles className="w-3 h-3" /> Salvar Coleção
                    </Button>
                  )}
                </div>

                {loadingDestinations || loadingLists ? (
                  <div className="flex flex-col items-center py-12 gap-3 opacity-20">
                    <Loader2 className="w-6 h-6 text-kinetic-orange animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      Acessando redes...
                    </span>
                  </div>
                ) : (
                  <div className="space-y-6 max-h-[460px] overflow-y-auto pr-2 custom-scrollbar">
                    {/* Listas Salvas */}
                    {savedLists && savedLists.length > 0 && (
                      <div className="space-y-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/40 px-1">
                          Suas Coleções
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {savedLists.map(list => {
                            const { total, selected, isAll, isPartial } = getListStats(list);
                            return (
                              <div
                                key={list.id}
                                onClick={() => handleToggleList(list)}
                                className={cn(
                                  "px-3 py-2 rounded-xl border-none transition-all cursor-pointer flex items-center gap-3",
                                  isAll 
                                    ? "bg-kinetic-orange shadow-glow-orange-intense text-black" 
                                    : isPartial 
                                    ? "bg-kinetic-orange/30 shadow-glow-orange text-white" 
                                    : "bg-deep-void shadow-skeuo-pressed text-white/40 hover:text-white/60"
                                )}
                              >
                                <LayoutList className={cn("w-3 h-3", isAll ? "text-black" : "text-kinetic-orange")} />
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-black uppercase tracking-tight truncate max-w-[120px]">
                                    {list.name}
                                  </span>
                                  <span className={cn("text-[7px] font-bold uppercase", isAll ? "text-black/60" : "text-white/20")}>
                                    {selected}/{total} GRUPOS
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="h-px bg-white/5 w-full my-4" />
                      </div>
                    )}
                    {Object.entries(groupedDestinations).map(([channelId, channelData]) => (
                      <div key={channelId} className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-kinetic-orange shadow-glow-orange" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                             {channelData.name} {channelData.phone ? `• ${channelData.phone}` : '• Sessão Ativa'}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          {channelData.groups.map(group => (
                            <div
                              key={group.id}
                              className={cn(
                                'flex items-center space-x-3 p-4 rounded-2xl border-none transition-all cursor-pointer',
                                selectedDestinations.includes(group.id)
                                  ? 'bg-kinetic-orange/10 shadow-skeuo-pressed'
                                  : 'bg-deep-void shadow-skeuo-pressed opacity-50 hover:opacity-80'
                              )}
                              onClick={() => handleToggleDestination(group.id)}
                            >
                              <Checkbox
                                checked={selectedDestinations.includes(group.id)}
                                onCheckedChange={() => handleToggleDestination(group.id)}
                                className="border-white/10 data-[state=checked]:bg-kinetic-orange data-[state=checked]:border-none"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-black uppercase tracking-widest text-white/90 truncate">
                                  {group.name}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[9px] text-white/20 font-bold uppercase">
                                    {(group as any).members_count} Membros • Ativo
                                  </span>
                                </div>
                              </div>
                              <Badge
                                variant="secondary"
                                className="bg-white/5 border-none text-[8px] font-black uppercase text-white/40 h-5"
                              >
                                GRUPO
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    
                    {groups?.length === 0 && (
                      <div className="py-12 flex flex-col items-center justify-center text-center opacity-30">
                        <AlertCircle className="w-8 h-8 mb-3" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Nenhum grupo encontrado</p>
                        <p className="text-[9px] font-bold uppercase mt-1">Sincronize seus canais primeiro</p>
                      </div>
                    )}
                  </div>
                )}
              </TactileCard>


              {activeCampaignId ? (
                <BroadcastMonitor 
                  campaignId={activeCampaignId}
                  productsCount={processedProducts.length}
                  groupsCount={selectedDestinations.length}
                  onNewCampaign={() => {
                    setActiveCampaignId(null);
                    setIsSuccess(false);
                    // O usuário decide se limpa a lista no "Reset" ou se continua
                  }}
                />
              ) : (
                <TactileCard className="p-8 border-none ring-1 ring-kinetic-orange/20 bg-gradient-to-br from-anthracite-surface to-deep-void shadow-skeuo-elevated sticky top-24">
                  <h3 className="text-xs font-black uppercase tracking-widest text-kinetic-orange mb-6 font-headline">
                    Sumário Operacional
                  </h3>

                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between items-center text-[10px] bg-white/5 p-3 rounded-xl border border-white/5">
                      <span className="text-white/30 font-bold uppercase tracking-widest">Payloads Gerados:</span>
                      <span className="font-black text-white/80 italic">{processedProducts.length} ITENS</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] bg-white/5 p-3 rounded-xl border border-white/5">
                      <span className="text-white/30 font-bold uppercase tracking-widest">Endpoints (Canais):</span>
                      <span className="font-black text-white/80 italic">{selectedDestinations.length} DESTINOS</span>
                    </div>
                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent w-full my-2" />
                    <div className="flex justify-between items-center py-2 px-1">
                      <span className="text-white/40 font-black uppercase tracking-[0.2em] text-[11px] font-headline italic">
                        Carga de Envio:
                      </span>
                      <div className="flex flex-col items-end">
                        <span className="font-black text-kinetic-orange text-2xl shadow-glow-orange-intense font-headline italic leading-none">
                          {processedProducts.length * selectedDestinations.length}
                        </span>
                        <span className="text-[8px] font-bold text-white/10 uppercase tracking-tighter mt-1">
                          mensagens em fila
                        </span>
                      </div>
                    </div>
                  </div>

                  <KineticButton
                    className="w-full h-15 font-black uppercase tracking-[0.2em] text-[11px] font-headline italic rounded-2xl shadow-glow-orange-intense transition-all hover:scale-[1.02] active:scale-[0.98]"
                    disabled={
                      isSending || processedProducts.length === 0 || selectedDestinations.length === 0
                    }
                    onClick={handleSend}
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-3 animate-spin" /> Sincronizando Satélites...
                      </>
                    ) : (
                      <>
                        <SendHorizonal className="w-4 h-4 mr-3" /> ATIVAR BROADCAST
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
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="test" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <TactileCard className="p-8 border-none ring-1 ring-white/5 space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shadow-skeuo-flat">
                  <SendHorizonal className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-black uppercase tracking-widest text-sm font-headline italic">Fogo Direto (M1)</h3>
                  <p className="text-[10px] uppercase text-white/40 font-bold tracking-tighter">
                    Telemetria Operational: Envio sem persistência em jobs
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-3 block italic">
                    1. Vetor de Saída (Canal)
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {channels?.map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setTestChannelId(c.id);
                          setTestGroupId(''); // Resetar grupo ao mudar canal
                        }}
                        className={cn(
                          'p-4 rounded-2xl border-none flex items-center gap-3 cursor-pointer transition-all',
                          testChannelId === c.id
                            ? 'bg-kinetic-orange/10 shadow-skeuo-pressed ring-1 ring-kinetic-orange/40'
                            : 'bg-deep-void shadow-skeuo-pressed opacity-50 hover:opacity-80'
                        )}
                      >
                        <div
                          className={cn(
                            'w-2.5 h-2.5 rounded-full shadow-[0_0_10px]',
                            c.config?.status === 'connected'
                              ? 'bg-emerald-500 shadow-emerald-500/50'
                              : 'bg-white/20 shadow-white/10'
                          )}
                        />
                        <div className="flex flex-col">
                          <span className={cn(
                            "text-xs font-black uppercase tracking-widest",
                            testChannelId === c.id ? "text-white" : "text-white/40"
                          )}>
                            {c.name}
                          </span>
                          <span className="text-[8px] font-bold text-white/10 uppercase">{c.config?.phoneNumber || 'Sessão sem número'}</span>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            'ml-auto border-none text-[8px] font-black uppercase tracking-widest h-5 px-2 rounded-lg',
                            c.type === 'telegram'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-emerald-500/10 text-emerald-400 shadow-glow-orange/5'
                          )}
                        >
                          {c.type === 'telegram' ? '🤖 TG' : '📱 WA'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedChannelType === 'whatsapp' && (
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-3 block italic">
                      2. Alvo Operacional (Grupo/JID)
                    </label>
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                      {availableTestGroups.length > 0 ? (
                        availableTestGroups.map(group => (
                          <div
                            key={group.id}
                            onClick={() => setTestGroupId(group.remote_id || '')}
                            className={cn(
                              'p-3 rounded-xl border-none flex items-center justify-between cursor-pointer transition-all',
                              testGroupId === group.remote_id
                                ? 'bg-white/10 shadow-skeuo-pressed ring-1 ring-white/20'
                                : 'bg-deep-void/50 opacity-40 hover:opacity-100'
                            )}
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="text-[11px] font-black uppercase tracking-tight text-white/90 truncate">
                                {group.name}
                              </span>
                              <span className="text-[9px] font-mono text-kinetic-orange font-bold uppercase tracking-tighter truncate">
                                {group.remote_id}
                              </span>
                            </div>
                            {testGroupId === group.remote_id && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-kinetic-orange" />
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="p-4 bg-deep-void rounded-xl border-dashed border border-white/5 text-center">
                          <p className="text-[9px] font-black text-white/20 uppercase">Nenhum grupo sincronizado neste canal</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4">
                      <p className="text-[10px] font-black text-white/30 uppercase mb-2 ml-1 italic">Ou Inserir Manual (Telefone/JID)</p>
                      <Input
                        value={testPhone}
                        onChange={e => {
                          setTestPhone(e.target.value);
                          if (e.target.value) setTestGroupId('');
                        }}
                        placeholder="Ex: 5547990000000 ou JID@g.us"
                        className="bg-deep-void border-none shadow-skeuo-pressed font-mono text-sm h-11"
                      />
                    </div>
                  </div>
                )}

                {selectedChannelType === 'telegram' && (
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-2 block">
                      Chat ID do Destinatário
                    </label>
                    <Input
                      value={testPhone}
                      onChange={e => setTestPhone(e.target.value)}
                      placeholder="Ex: -1001234567890"
                      className="bg-deep-void border-none shadow-skeuo-pressed font-mono text-sm h-11"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-3 block italic">
                    3. Conteúdo do Disparo
                  </label>
                  <Textarea
                    value={testMessage}
                    onChange={e => setTestMessage(e.target.value)}
                    className="bg-deep-void border-none shadow-skeuo-pressed min-h-[100px] text-xs font-mono p-4"
                  />
                </div>

                <KineticButton
                  className="w-full h-14 font-black uppercase tracking-[0.2em] text-[11px] font-headline italic rounded-2xl shadow-glow-orange-intense"
                  onClick={handleTestSend}
                  disabled={isTesting || !testChannelId || (!testPhone && !testGroupId) || !testMessage}
                >
                  {isTesting ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-3" />
                  ) : (
                    <SendHorizonal className="w-4 h-4 mr-3" />
                  )}
                  {isTesting ? 'TRANSMITINDO SINAL...' : 'DISPARAR AGORA'}
                </KineticButton>
              </div>
            </TactileCard>

            <div className="space-y-6">
              <TactileCard className="p-8 border-none ring-1 ring-white/5 min-h-[400px] flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shadow-skeuo-flat">
                      <LayoutList className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-black uppercase tracking-widest text-sm font-headline italic">Response Audit</h3>
                      <p className="text-[10px] uppercase text-white/40 font-bold tracking-tighter">
                        Inspeção de Baixo Nível do Provedor
                      </p>
                    </div>
                  </div>
                  {lastApiResponse && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-none uppercase text-[8px] font-black">
                      Live Feed
                    </Badge>
                  )}
                </div>

                <div className="flex-1 bg-black/40 rounded-2xl p-6 shadow-skeuo-pressed border border-white/5 overflow-hidden flex flex-col">
                  {lastApiResponse ? (
                    <div className="flex-1 overflow-auto custom-scrollbar">
                      <pre className="text-[10px] font-mono leading-relaxed text-emerald-400/90 whitespace-pre-wrap">
                        {JSON.stringify(lastApiResponse, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center opacity-20">
                      <Sparkles className="w-12 h-12 mb-4 text-white/50" />
                      <p className="text-[10px] font-black uppercase tracking-widest italic">Aguardando Transmissão</p>
                      <p className="text-[8px] font-bold uppercase mt-1">Os dados de retorno aparecerão aqui após o disparo</p>
                    </div>
                  )}
                </div>

                {lastApiResponse && (
                  <div className="mt-6 p-4 bg-deep-void/50 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                       <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                       <span className="text-[9px] font-black uppercase tracking-widest text-white/60">Análise de Payload</span>
                    </div>
                    <p className="text-[9px] font-bold uppercase text-white/30 leading-relaxed">
                      O Provedor (M1) aceitou a requisição. Verifique o status acima para confirmar o 'wasender_message_id'.
                    </p>
                  </div>
                )}
              </TactileCard>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      <SaveListDialog 
        open={isSaveListOpen}
        onOpenChange={setIsSaveListOpen}
        selectedGroupIds={selectedDestinations}
        userId={user?.id as string}
      />
    </LayoutContainer>
  );
}