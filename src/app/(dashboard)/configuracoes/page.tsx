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
import { useProfile } from '@/hooks/use-profile';
import { useSendPreferences } from '@/hooks/use-send-preferences';
import { useEffect } from 'react';

export default function ConfiguracoesPage() {
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();
    
    // Suporte a deep linking para abas (ex: ?tab=billing)
    const initialTab = searchParams.get('tab') || 'profile';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [isRestarting, setIsRestarting] = useState(false);
    
    // Perfil State
    const { profile, updateProfile, isUpdating } = useProfile(user?.id);
    const [fullName, setFullName] = useState('');
    
    useEffect(() => {
      if (profile?.full_name) {
        setFullName(profile.full_name);
      }
    }, [profile]);

    // Send Preferences State
    const { preferences, upsertPreferences, isUpdating: isUpdatingPreferences } = useSendPreferences(user?.id);
    const [sendWindowStart, setSendWindowStart] = useState('');
    const [sendWindowEnd, setSendWindowEnd] = useState('');

    useEffect(() => {
      if (preferences) {
        setSendWindowStart(preferences.send_window_start || '');
        setSendWindowEnd(preferences.send_window_end || '');
      }
    }, [preferences]);
    
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
                        <TabsTrigger value="automation" className="text-[10px] uppercase font-black tracking-widest gap-2 rounded-lg"><Zap className="w-3.5 h-3.5" /> Automação</TabsTrigger>
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
                                        <AvatarFallback className="bg-kinetic-orange text-black text-2xl font-black italic">
                                          {fullName ? fullName.substring(0, 2).toUpperCase() : '??'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="space-y-1">
                                        <Button variant="outline" size="sm" className="h-8 bg-transparent border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-kinetic-orange/10 hover:text-kinetic-orange transition-all">Alterar Identidade Visual</Button>
                                        <p className="text-[9px] text-white/20 uppercase font-medium tracking-tighter">Avatar usado em logs e auditorias de envio</p>
                                    </div>
                                </div>
    
                                <div className="grid md:grid-cols-2 gap-x-12 gap-y-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">Nome de Operador</Label>
                                        <Input 
                                          value={fullName} 
                                          onChange={(e) => setFullName(e.target.value)}
                                          placeholder="Seu nome operacional"
                                          className="bg-deep-void border-none shadow-skeuo-pressed h-11" 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">Email Principal</Label>
                                        <Input defaultValue={user?.email || ''} disabled className="bg-deep-void/50 border-none shadow-skeuo-pressed opacity-50 h-11" />
                                    </div>
                                    <div className="space-y-2 opacity-50">
                                        <div className="flex justify-between items-center">
                                          <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">WhatsApp de Auditoria</Label>
                                          <Badge variant="outline" className="h-4 text-[8px] font-black uppercase border-none bg-white/5 text-white/40 italic">Breve</Badge>
                                        </div>
                                        <Input disabled placeholder="+55 11 99999-9999" className="bg-deep-void border-none shadow-skeuo-pressed h-11 cursor-not-allowed" />
                                        <p className="text-[9px] text-white/20 uppercase font-bold tracking-tight italic">Detectado em logs de saída de mensagens</p>
                                    </div>
                                    <div className="space-y-2 opacity-50">
                                      <div className="flex justify-between items-center">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">Fuso Horário Operacional</Label>
                                        <Badge variant="outline" className="h-4 text-[8px] font-black uppercase border-none bg-white/5 text-white/40 italic">Em Breve</Badge>
                                      </div>
                                        <Select defaultValue="america_sp" disabled>
                                            <SelectTrigger className="bg-deep-void border-none shadow-skeuo-pressed h-11 cursor-not-allowed"><SelectValue /></SelectTrigger>
                                            <SelectContent className="bg-anthracite-surface border-white/5">
                                                <SelectItem value="america_sp">América/São Paulo (UTC-3)</SelectItem>
                                                <SelectItem value="america_manaus">América/Manaus (UTC-4)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[9px] text-kinetic-orange/40 uppercase font-black tracking-tighter">Impacto: Agendamentos, Automações e Relatórios</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-4 mt-8">
                                    <Button 
                                      className="h-12 px-8 font-black uppercase tracking-widest text-xs rounded-xl bg-kinetic-orange text-black hover:bg-kinetic-orange/90 shadow-glow-orange-intense transition-all disabled:opacity-50" 
                                      onClick={() => updateProfile({ full_name: fullName })}
                                      disabled={isUpdating || !fullName}
                                    >
                                        {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                        {isUpdating ? 'Sincronizando...' : 'Salvar Identidade'}
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
    

    
                    <TabsContent value="automation" className="space-y-6 animate-in fade-in-50 duration-300">
                        <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
                            <Card className="p-6 md:col-span-2 border-none ring-1 ring-white/5 bg-anthracite-surface/50">
                                <div className="flex items-center gap-3 mb-2">
                                    <Clock className="w-5 h-5 text-kinetic-orange" />
                                    <h3 className="font-bold text-lg font-headline italic">Horário permitido para envios</h3>
                                </div>
                                <p className="text-[11px] text-white/30 uppercase tracking-widest mb-8 italic leading-relaxed">
                                    Define quando o SYNCO pode enviar mensagens automaticamente. Fora desse horário, os produtos ficam pausados na fila e são enviados quando o horário voltar.
                                </p>

                                <div className="p-6 rounded-[24px] bg-black/20 border border-white/5 shadow-skeuo-pressed space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">Início do Turno (Das)</Label>
                                            <input 
                                                type="time" 
                                                className="bg-deep-void border border-white/5 h-12 w-full px-4 text-xs font-black rounded-xl shadow-skeuo-pressed outline-none focus:ring-1 focus:ring-kinetic-orange/30 transition-all text-white"
                                                value={sendWindowStart || ''} 
                                                onChange={(e) => setSendWindowStart(e.target.value)} 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">Fim do Turno (Até)</Label>
                                            <input 
                                                type="time" 
                                                className="bg-deep-void border border-white/5 h-12 w-full px-4 text-xs font-black rounded-xl shadow-skeuo-pressed outline-none focus:ring-1 focus:ring-kinetic-orange/30 transition-all text-white"
                                                value={sendWindowEnd || ''} 
                                                onChange={(e) => setSendWindowEnd(e.target.value)} 
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-4 flex flex-wrap gap-4 border-t border-white/5">
                                        <Button 
                                            className="h-12 px-8 font-black uppercase tracking-widest text-xs rounded-xl bg-kinetic-orange text-black hover:bg-kinetic-orange/90 shadow-glow-orange-intense transition-all"
                                            onClick={() => upsertPreferences({ 
                                                send_window_start: sendWindowStart || null, 
                                                send_window_end: sendWindowEnd || null,
                                                send_window_timezone: 'America/Sao_Paulo'
                                            })}
                                            disabled={!!isUpdatingPreferences || (!!sendWindowStart !== !!sendWindowEnd)}
                                        >
                                            {isUpdatingPreferences ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                            Salvar horário de envio
                                        </Button>

                                        <Button 
                                            variant="outline"
                                            className="h-12 px-8 font-black uppercase tracking-widest text-xs rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 shadow-skeuo-flat transition-all"
                                            onClick={() => {
                                                setSendWindowStart('');
                                                setSendWindowEnd('');
                                                upsertPreferences({ 
                                                    send_window_start: null, 
                                                    send_window_end: null,
                                                    send_window_timezone: 'America/Sao_Paulo'
                                                });
                                            }}
                                            disabled={isUpdatingPreferences}
                                        >
                                            <Send className="w-4 h-4 mr-2 text-emerald-400" />
                                            Enviar em qualquer horário
                                        </Button>
                                    </div>
                                    
                                    <p className="text-[9px] text-white/20 uppercase font-bold tracking-tight italic">
                                        * Essa configuração vale para todos os Radares e campanhas automáticas da sua conta.
                                    </p>
                                </div>
                            </Card>
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
