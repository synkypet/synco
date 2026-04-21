"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import PageHeader from '@/components/shared/PageHeader';
import {
    User as UserIcon, Building2, Clock, Users, Palette, Save, Plus,
    CheckCircle2, AlertCircle, TestTube, HelpCircle, Sparkles,
    Shield, Send, BookOpen, Loader2, ChevronRight, Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  useMarketplaceCatalog, 
  useUserMarketplaceConnections, 
  useUpsertMarketplaceConnection 
} from '@/hooks/use-marketplaces';
import { AffiliateSettingsCard } from '@/components/settings/AffiliateSettingsCard';

export default function ConfiguracoesPage() {
    const { user } = useAuth();
    const router = useRouter();
    const supabase = createClient();
    const [activeTab, setActiveTab] = useState('profile');
    const [isRestarting, setIsRestarting] = useState(false);
    
    // Real Data Hooks
    const { data: catalog, isLoading: isLoadingCatalog } = useMarketplaceCatalog();
    const { data: connections, isLoading: isLoadingConnections } = useUserMarketplaceConnections(user?.id);
    const updateConnection = useUpsertMarketplaceConnection();

    const handleSaveConnection = (data: any) => {
      if (!user?.id) return;
      updateConnection.mutate({
        user_id: user.id,
        ...data
      });
    };

    const handleRestartTutorial = async () => {
      setIsRestarting(true);
      try {
        const { error } = await supabase.auth.updateUser({
          data: { onboarding_completed: false }
        });
        if (error) throw error;
        
        toast.success('Tutorial reiniciado! Redirecionando...');
        // Refresh para o AppLayout detectar a mudança no metadata
        router.refresh();
        // Opcionalmente trocar de aba ou ir para Home
        router.push('/');
      } catch (err) {
        console.error('Erro ao reiniciar tutorial:', err);
        toast.error('Erro ao reiniciar tutorial.');
      } finally {
        setIsRestarting(false);
      }
    };

    return (
        <div className="space-y-6">
            <PageHeader 
                title="Configurações" 
                description="Gerencie seu perfil, programas de afiliado e preferências do sistema" 
            />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-muted/50 p-1 rounded-xl flex-wrap h-auto gap-1">
                    <TabsTrigger value="profile" className="text-xs gap-2 rounded-lg"><UserIcon className="w-3.5 h-3.5" /> Perfil</TabsTrigger>
                    <TabsTrigger value="org" className="text-xs gap-2 rounded-lg"><Building2 className="w-3.5 h-3.5" /> Organização</TabsTrigger>
                    <TabsTrigger value="affiliates" className="text-xs gap-2 rounded-lg">🛍️ Afiliados</TabsTrigger>
                    <TabsTrigger value="send" className="text-xs gap-2 rounded-lg"><Send className="w-3.5 h-3.5" /> Envios</TabsTrigger>
                    <TabsTrigger value="ia" className="text-xs gap-2 rounded-lg"><Sparkles className="w-3.5 h-3.5" /> IA & Texto</TabsTrigger>
                    <TabsTrigger value="users" className="text-xs gap-2 rounded-lg"><Users className="w-3.5 h-3.5" /> Usuários</TabsTrigger>
                    <TabsTrigger value="appearance" className="text-xs gap-2 rounded-lg"><Palette className="w-3.5 h-3.5" /> Aparência</TabsTrigger>
                    <TabsTrigger value="onboarding" className="text-xs gap-2 rounded-lg"><BookOpen className="w-3.5 h-3.5" /> Ajuda</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-6 animate-in fade-in-50 duration-300">
                    <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
                        <Card className="p-6 md:col-span-2 border-none ring-1 ring-white/5 bg-anthracite-surface/50">
                            <h3 className="font-bold text-lg mb-2">Informações Pessoais</h3>
                            <p className="text-[11px] text-white/30 uppercase tracking-widest mb-8 italic">Dados de identificação e sincronia</p>
                            
                            <div className="flex items-center gap-6 mb-8 bg-black/20 p-4 rounded-2xl border border-white/5">
                                <Avatar className="w-20 h-20 border-2 border-kinetic-orange/20 shadow-glow-orange/10">
                                    <AvatarFallback className="bg-kinetic-orange text-black text-2xl font-black italic">JS</AvatarFallback>
                                </Avatar>
                                <div className="space-y-1">
                                    <Button variant="outline" size="sm" className="h-8 bg-transparent border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-kinetic-orange/10 hover:text-kinetic-orange transition-all">Alterar Identidade Visual</Button>
                                    <p className="text-[9px] text-white/20 uppercase font-medium tracking-tighter">Avatar usado em logs e auditorias de envio</p>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-x-12 gap-y-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">Nome de Operador</Label>
                                    <Input defaultValue="João Silva" className="bg-deep-void border-none shadow-skeuo-pressed" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">Email Principal</Label>
                                    <Input defaultValue={user?.email || ''} disabled className="bg-deep-void/50 border-none shadow-skeuo-pressed opacity-50" />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">WhatsApp de Auditoria</Label>
                                      <Badge variant="outline" className="h-4 text-[8px] font-black uppercase border-none bg-emerald-500/10 text-emerald-500">ID Ativo</Badge>
                                    </div>
                                    <Input placeholder="+55 11 99999-9999" className="bg-deep-void border-none shadow-skeuo-pressed" />
                                    <p className="text-[9px] text-white/20 uppercase font-bold tracking-tight italic">Detectado em logs de saída de mensagens</p>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">Fuso Horário Operacional</Label>
                                    <AlertCircle className="w-3 h-3 text-kinetic-orange" />
                                  </div>
                                    <Select defaultValue="america_sp">
                                        <SelectTrigger className="bg-deep-void border-none shadow-skeuo-pressed"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-anthracite-surface border-white/5">
                                            <SelectItem value="america_sp">América/São Paulo (UTC-3)</SelectItem>
                                            <SelectItem value="america_manaus">América/Manaus (UTC-4)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[9px] text-kinetic-orange/40 uppercase font-black tracking-tighter">Impacto: Agendamentos, Automações e Relatórios</p>
                                </div>
                            </div>
                            <Button className="mt-8 h-12 px-8 font-black uppercase tracking-widest text-xs rounded-xl bg-kinetic-orange text-black hover:bg-kinetic-orange/90 shadow-glow-orange-intense transition-all" onClick={() => toast.success('Perfil sincronizado!')}>
                                <Save className="w-4 h-4 mr-2" /> Salvar Identidade
                            </Button>
                        </Card>

                    </div>
                </TabsContent>

                <TabsContent value="affiliates" className="space-y-6 animate-in fade-in-50 duration-300">
                    <div className="bg-kinetic-orange/5 border border-kinetic-orange/20 p-6 rounded-2xl mb-2">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-kinetic-orange/10 flex items-center justify-center shrink-0 shadow-skeuo-flat border border-kinetic-orange/20">
                          <Zap className="w-5 h-5 text-kinetic-orange" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-widest text-kinetic-orange mb-1 font-headline italic">Motor de Gerenciamento Factual</h4>
                          <p className="text-[11px] text-white/40 leading-relaxed max-w-3xl">
                            Insira suas credenciais oficiais abaixo. Este motor é o cérebro que permite ao SYNCO transformar links de terceiros em seus links proprietários, 
                            garantindo a atribuição correta de comissões e o tracking em tempo real.
                          </p>
                        </div>
                      </div>
                    </div>

                    {isLoadingCatalog || isLoadingConnections ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-30">
                        <Loader2 className="w-10 h-10 animate-spin text-kinetic-orange" />
                        <span className="font-black text-sm uppercase tracking-widest">Sincronizando Marketplace...</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                        {catalog?.map(mp => {
                          const connection = connections?.find(c => c.marketplace_id === mp.id);
                          return (
                            <AffiliateSettingsCard 
                              key={mp.id}
                              marketplace={mp}
                              connection={connection}
                              isSaving={updateConnection.isPending}
                              onSave={handleSaveConnection}
                            />
                          );
                        })}
                      </div>
                    )}
                </TabsContent>

                <TabsContent value="org" className="animate-in fade-in-50 duration-300">
                    <div className="grid md:grid-cols-2 gap-8 items-start max-w-5xl">
                        <Card className="p-8 border-none ring-1 ring-white/5 bg-anthracite-surface/80 shadow-skeuo-elevated">
                            <h3 className="font-black uppercase tracking-widest text-xs text-white/60 mb-6 italic">Estrutura Operacional</h3>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-white/30">Nome da Organização</Label>
                                    <Input defaultValue="Synco Affiliate Ops" className="bg-deep-void border-none shadow-skeuo-pressed h-11" />
                                    <p className="text-[8px] text-white/10 uppercase font-black">Usado em identificadores de API e cabeçalhos de auditoria</p>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                      <Label className="text-[10px] font-black uppercase tracking-widest text-white/30">Slug Organizacional</Label>
                                      <Shield className="w-3.5 h-3.5 text-kinetic-orange/40" />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[11px] text-white/20 font-mono tracking-tighter shrink-0">synco.app/</span>
                                        <Input defaultValue="synco-ops" className="font-mono h-11 text-xs bg-deep-void border-none shadow-skeuo-pressed text-kinetic-orange" />
                                    </div>
                                    <p className="text-[8px] text-kinetic-orange/30 uppercase font-black tracking-widest">Contexto: Identificador de recurso global e landing nodes</p>
                                </div>

                                <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent w-full" />

                                <div className="flex items-center justify-between p-5 rounded-2xl bg-black/40 border border-white/5 shadow-skeuo-pressed">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white/60 font-headline italic">Plano Master (M1)</p>
                                        <p className="text-[9px] text-white/20 uppercase font-bold tracking-tighter">Renovação: 12 de Abril, 2026</p>
                                    </div>
                                    <Button variant="ghost" size="sm" className="text-[9px] font-black uppercase text-kinetic-orange hover:bg-kinetic-orange/5">UPGRADE</Button>
                                </div>
                                <Button onClick={() => toast.success('Org atualizada!')} className="w-full h-12 font-black uppercase tracking-widest text-[11px] rounded-xl bg-white text-black hover:bg-white/90 shadow-skeuo-elevated">
                                    <Save className="w-4 h-4 mr-2" /> Sincronizar Organização
                                </Button>
                            </div>
                        </Card>

                        <div className="p-8 rounded-3xl bg-deep-void/50 border border-dashed border-white/10 flex flex-col items-center justify-center text-center opacity-40 grayscale min-h-[300px]">
                          <Building2 className="w-12 h-12 mb-4 text-white/20" />
                          <h4 className="text-xs font-black uppercase tracking-widest text-white/40 mb-2">Visibilidade Global</h4>
                          <p className="text-[10px] max-w-[200px] leading-relaxed uppercase font-bold tracking-tighter">
                            As configurações desta aba aplicam-se a todos os operadores e canais vinculados a esta organização.
                          </p>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="send" className="animate-in fade-in-50 duration-300">
                    <Card className="p-12 border-none bg-deep-void/50 ring-1 ring-white/5 flex flex-col items-center text-center max-w-4xl">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-8 shadow-skeuo-flat border border-white/5">
                          <Send className="w-8 h-8 text-white/20 font-thin" />
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tight font-headline italic mb-4 text-white/80">Sequenciador & Pacing</h3>
                        <p className="text-sm text-white/30 leading-relaxed max-w-xl mb-8 uppercase font-bold tracking-tighter">
                           Em breve: Controle de cadência de envio, limites de cooldown por canal e políticas de tentativa automática (retry) em casos de falha de sinal do Wasender.
                        </p>
                        <Badge variant="outline" className="bg-kinetic-orange/10 text-kinetic-orange border-kinetic-orange/20 px-4 h-7 text-[9px] font-black uppercase tracking-widest">Protocolo de Segurança Ativo (Padrão)</Badge>
                    </Card>
                </TabsContent>

                <TabsContent value="ia" className="animate-in fade-in-50 duration-300">
                    <Card className="p-12 border-none bg-deep-void/50 ring-1 ring-white/5 flex flex-col items-center text-center max-w-4xl">
                        <div className="w-16 h-16 rounded-2xl bg-purple-500/5 flex items-center justify-center mb-8 shadow-skeuo-flat border border-purple-500/10">
                          <Sparkles className="w-8 h-8 text-purple-400/40" />
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tight font-headline italic mb-4 text-white/80">Vibe Engine (IA Custom)</h3>
                        <p className="text-sm text-white/30 leading-relaxed max-w-xl mb-8 uppercase font-bold tracking-tighter">
                           Em breve: Treine sua própria IA com exemplos de suas cópias. Configure a tonalidade padrão (M1, Divertido, Urgente) para todos os processamentos de links automáticos.
                        </p>
                        <div className="flex gap-4">
                          <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-none px-3 h-6 text-[8px] font-black uppercase italic tracking-widest">Brain Mode: 0.1v</Badge>
                          <Badge variant="outline" className="bg-white/5 text-white/20 border-none px-3 h-6 text-[8px] font-black uppercase tracking-widest">Aguardando Dataset</Badge>
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="users" className="animate-in fade-in-50 duration-300">
                    <Card className="p-12 border-none bg-deep-void/50 ring-1 ring-white/5 flex flex-col items-center text-center max-w-4xl">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-8 shadow-skeuo-flat border border-white/5">
                          <Users className="w-8 h-8 text-white/10" />
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tight font-headline italic mb-4 text-white/80">Gestão de Equipe</h3>
                        <p className="text-sm text-white/30 leading-relaxed max-w-xl mb-8 uppercase font-bold tracking-tighter">
                           Em breve: Adicione operadores auxiliares, gerencie permissões de acesso e acompanhe a produtividade por usuário dentro da organização.
                        </p>
                        <Button disabled className="opacity-30 bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest h-10 px-6 rounded-xl">Convidar Operador</Button>
                    </Card>
                </TabsContent>

                <TabsContent value="appearance" className="animate-in fade-in-50 duration-300">
                    <Card className="p-12 border-none bg-deep-void/50 ring-1 ring-white/5 flex flex-col items-center text-center max-w-4xl">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-8 shadow-skeuo-flat border border-white/5">
                          <Palette className="w-8 h-8 text-white/10" />
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tight font-headline italic mb-4 text-white/80">Temas & Visual</h3>
                        <p className="text-sm text-white/30 leading-relaxed max-w-xl mb-8 uppercase font-bold tracking-tighter">
                           Em breve: Customização total do dashboard. Alternância entre modos Dark/High-Contrast e ajuste de intensidade dos glows neon.
                        </p>
                        <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-none px-4 h-7 text-[9px] font-black uppercase tracking-widest italic shadow-glow-orange/5">Current Theme: Synco Dark (Factual)</Badge>
                    </Card>
                </TabsContent>

                <TabsContent value="onboarding" className="animate-in fade-in-50 duration-300">
                    <div className="grid md:grid-cols-2 gap-6 max-w-5xl">
                        <Card className="p-8 border-none ring-1 ring-white/5 bg-gradient-to-br from-anthracite-surface to-deep-void shadow-skeuo-elevated h-fit">
                            <div className="w-12 h-12 rounded-2xl bg-kinetic-orange/10 flex items-center justify-center mb-6 shadow-skeuo-flat border border-kinetic-orange/20">
                                <BookOpen className="w-6 h-6 text-kinetic-orange" />
                            </div>
                            <h3 className="text-xl font-black uppercase tracking-tight font-headline italic mb-4">Treinamento SYNCO</h3>
                            <p className="text-sm text-white/40 leading-relaxed mb-8">
                                Quer rever os conceitos básicos da plataforma? Nosso tutorial guiado explica 
                                desde a configuração de canais até a análise de ganhos.
                            </p>
                            <Button 
                                onClick={handleRestartTutorial} 
                                disabled={isRestarting}
                                className="w-full h-12 font-black uppercase tracking-wider text-xs rounded-xl bg-kinetic-orange text-black hover:bg-kinetic-orange/90 shadow-glow-orange-intense transition-all"
                            >
                                {isRestarting ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                    <Sparkles className="w-4 h-4 mr-2" />
                                )}
                                Reiniciar Passo a Passo
                            </Button>
                        </Card>

                        <div className="space-y-6">
                            <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                                <h4 className="font-black uppercase tracking-widest text-[11px] text-white/60 mb-4 flex items-center gap-2 italic">
                                    <Shield className="w-3.5 h-3.5 text-blue-400" /> Fluxo de Ativação
                                </h4>
                                <ul className="space-y-4">
                                    <li className="flex items-start gap-3">
                                        <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0 mt-0.5">
                                            <CheckCircle2 className="w-3 h-3" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold uppercase text-white/80">Configurar Afiliado</p>
                                            <p className="text-[9px] text-white/30 uppercase tracking-tighter">API Keys da Shopee e ID de Afiliado</p>
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0 mt-0.5">
                                            <CheckCircle2 className="w-3 h-3" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold uppercase text-white/80">Conectar Canal</p>
                                            <p className="text-[9px] text-white/30 uppercase tracking-tighter">WhatsApp ou Telegram via Wasender</p>
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-white/20 shrink-0 mt-0.5">
                                            <Clock className="w-3 h-3" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold uppercase text-white/40 tracking-widest">Sincronizar Grupos</p>
                                            <p className="text-[9px] text-white/20 uppercase tracking-tighter">Vetores de destino multiponto</p>
                                        </div>
                                    </li>
                                </ul>
                            </div>

                            <div className="p-6 rounded-2xl bg-deep-void border border-white/5 shadow-skeuo-pressed">
                                <h4 className="font-black uppercase tracking-widest text-[11px] text-white/40 mb-3 italic">Documentação</h4>
                                <p className="text-[10px] leading-relaxed text-white/20 mb-4">
                                    Para dúvidas técnicas avançadas, consulte nosso manual de operações.
                                </p>
                                <Button variant="link" className="p-0 h-auto text-kinetic-orange text-[10px] font-black uppercase tracking-widest hover:text-kinetic-orange/80">
                                    Abrir Wiki M1 <ChevronRight className="w-3 h-3 ml-1" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
