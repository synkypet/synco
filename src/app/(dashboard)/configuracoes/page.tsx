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
    Shield, Send, BookOpen, Loader2, ChevronRight, Zap, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { 
  useMarketplaceCatalog, 
  useUserMarketplaceConnections, 
  useUpsertMarketplaceConnection 
} from '@/hooks/use-marketplaces';
import { AffiliateSettingsCard } from '@/components/settings/AffiliateSettingsCard';
import { PlanDetailsCard } from '@/components/billing/PlanDetailsCard';

export default function ConfiguracoesPage() {
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();
    
    // Suporte a deep linking para abas (ex: ?tab=billing)
    const initialTab = searchParams.get('tab') || 'profile';
    const [activeTab, setActiveTab] = useState(initialTab);
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
        <div className="max-w-6xl mx-auto px-4 sm:px-8 lg:px-12 py-4">
            <div className="space-y-8">
                <PageHeader 
                    title="Configurações" 
                    description="Gerencie seu perfil, programas de afiliado e preferências do sistema" 
                />

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
                    <TabsList className="bg-muted/30 p-1 rounded-xl flex-wrap h-auto gap-1 border border-white/5 shadow-skeuo-pressed">
                        <TabsTrigger value="profile" className="text-[10px] uppercase font-black tracking-widest gap-2 rounded-lg"><UserIcon className="w-3.5 h-3.5" /> Perfil</TabsTrigger>
                        <TabsTrigger value="org" className="text-[10px] uppercase font-black tracking-widest gap-2 rounded-lg"><Building2 className="w-3.5 h-3.5" /> Organização</TabsTrigger>
                        <TabsTrigger value="billing" className="text-[10px] uppercase font-black tracking-widest gap-2 rounded-lg"><Shield className="w-3.5 h-3.5" /> Assinatura</TabsTrigger>
                        <TabsTrigger value="affiliates" className="text-[10px] uppercase font-black tracking-widest gap-2 rounded-lg">🛍️ Afiliados</TabsTrigger>
                    </TabsList>
    
                    <TabsContent value="profile" className="space-y-6 animate-in fade-in-50 duration-300">
                        <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
                            <Card className="p-6 md:col-span-2 border-none ring-1 ring-white/5 bg-anthracite-surface/50">
                                <h3 className="font-bold text-lg mb-2 font-headline italic">Informações Pessoais</h3>
                                <p className="text-[11px] text-white/30 uppercase tracking-widest mb-8 italic">Dados de identificação e sincronia</p>
                                
                                <div className="flex items-center gap-6 mb-8 bg-black/20 p-4 rounded-2xl border border-white/5 shadow-skeuo-pressed">
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
                                        <Input defaultValue="João Silva" className="bg-deep-void border-none shadow-skeuo-pressed h-11" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">Email Principal</Label>
                                        <Input defaultValue={user?.email || ''} disabled className="bg-deep-void/50 border-none shadow-skeuo-pressed opacity-50 h-11" />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                          <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">WhatsApp de Auditoria</Label>
                                          <Badge variant="outline" className="h-4 text-[8px] font-black uppercase border-none bg-emerald-500/10 text-emerald-500">ID Ativo</Badge>
                                        </div>
                                        <Input placeholder="+55 11 99999-9999" className="bg-deep-void border-none shadow-skeuo-pressed h-11" />
                                        <p className="text-[9px] text-white/20 uppercase font-bold tracking-tight italic">Detectado em logs de saída de mensagens</p>
                                    </div>
                                    <div className="space-y-2">
                                      <div className="flex justify-between items-center">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">Fuso Horário Operacional</Label>
                                        <AlertCircle className="w-3 h-3 text-kinetic-orange" />
                                      </div>
                                        <Select defaultValue="america_sp">
                                            <SelectTrigger className="bg-deep-void border-none shadow-skeuo-pressed h-11"><SelectValue /></SelectTrigger>
                                            <SelectContent className="bg-anthracite-surface border-white/5">
                                                <SelectItem value="america_sp">América/São Paulo (UTC-3)</SelectItem>
                                                <SelectItem value="america_manaus">América/Manaus (UTC-4)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[9px] text-kinetic-orange/40 uppercase font-black tracking-tighter">Impacto: Agendamentos, Automações e Relatórios</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-4 mt-8">
                                    <Button className="h-12 px-8 font-black uppercase tracking-widest text-xs rounded-xl bg-kinetic-orange text-black hover:bg-kinetic-orange/90 shadow-glow-orange-intense transition-all" onClick={() => toast.success('Perfil sincronizado!')}>
                                        <Save className="w-4 h-4 mr-2" /> Salvar Identidade
                                    </Button>

                                    <Link href="/configuracoes/templates">
                                        <Button variant="outline" className="h-12 px-8 font-black uppercase tracking-widest text-xs rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 shadow-skeuo-flat transition-all">
                                            <Sparkles className="w-4 h-4 mr-2 text-purple-400" /> Templates de Mensagem
                                        </Button>
                                    </Link>
                                </div>
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
                                <h3 className="font-black uppercase tracking-widest text-xs text-white/60 mb-6 italic font-headline">Estrutura Operacional</h3>
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
    
                                    <Button onClick={() => toast.success('Org atualizada!')} className="w-full h-12 font-black uppercase tracking-widest text-[11px] rounded-xl bg-white text-black hover:bg-white/90 shadow-skeuo-elevated">
                                        <Save className="w-4 h-4 mr-2" /> Sincronizar Organização
                                    </Button>
                                </div>
                            </Card>
    
                            <div className="p-8 rounded-3xl bg-deep-void/50 border border-dashed border-white/10 flex flex-col items-center justify-center text-center opacity-40 grayscale min-h-[300px]">
                              <Building2 className="w-12 h-12 mb-4 text-white/20" />
                              <h4 className="text-xs font-black uppercase tracking-widest text-white/40 mb-2 font-headline italic">Visibilidade Global</h4>
                              <p className="text-[10px] max-w-[200px] leading-relaxed uppercase font-bold tracking-tighter">
                                As configurações desta aba aplicam-se a todos os operadores e canais vinculados a esta organização.
                              </p>
                            </div>
                        </div>
                    </TabsContent>
    
                    <TabsContent value="billing" className="animate-in fade-in-50 duration-300">
                        <PlanDetailsCard />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
