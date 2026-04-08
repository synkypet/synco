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
    Shield, Send, BookOpen, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const MOCK_USERS = [
    { name: 'João Silva', email: 'joao@synco.com', role: 'owner', avatar: 'JS' },
    { name: 'Maria Souza', email: 'maria@synco.com', role: 'admin', avatar: 'MS' },
    { name: 'Pedro Santos', email: 'pedro@synco.com', role: 'operador', avatar: 'PS' },
];

const ROLES = [
    { value: 'owner', label: 'Proprietário', desc: 'Acesso total, incluindo faturamento e configurações' },
    { value: 'admin', label: 'Administrador', desc: 'Gerencia tudo exceto faturamento e planos' },
    { value: 'operador', label: 'Operador', desc: 'Campanhas, templates, automações e envios' },
    { value: 'analista', label: 'Analista', desc: 'Somente relatórios e visualização' },
];

const MARKETPLACE_HELP: Record<string, string> = {
    shopee: 'Shopee Affiliate Center → Minha conta → ID de afiliado',
    mercadolivre: 'Programa de Parceiros ML → Configurações → ID do publisher',
    amazon: 'Amazon Associates → Ferramentas → Store ID',
    magalu: 'Parceiro Magalu → Integração → Código de afiliado',
    aliexpress: 'AliExpress Portals → Ferramentas → PID',
    shein: 'Shein Affiliate → Conta → Código único',
};

const MOCK_MARKETPLACES = [
    { id: 'shopee', name: 'Shopee', icon: '🟠', description: 'Programa de Afiliados Shopee', configured: true, affiliate_id: '123456789', last_validated: '2024-03-20' },
    { id: 'mercadolivre', name: 'Mercado Livre', icon: '🟡', description: 'Mercado Livre Parceiros', configured: true, affiliate_id: 'ML-998877', last_validated: '2024-03-21' },
    { id: 'amazon', name: 'Amazon', icon: '🔵', description: 'Amazon Associates', configured: false, affiliate_id: '', last_validated: null },
    { id: 'magalu', name: 'Magalu', icon: '🔵', description: 'Parceiro Magalu', configured: false, affiliate_id: '', last_validated: null },
];

export default function ConfiguracoesPage() {
    const [activeTab, setActiveTab] = useState('profile');
    const [scheduleEnabled, setScheduleEnabled] = useState(true);
    const [marketplaces, setMarketplaces] = useState(MOCK_MARKETPLACES);
    const [testingId, setTestingId] = useState<string | null>(null);
    const [editingMp, setEditingMp] = useState<string | null>(null);
    const [tempId, setTempId] = useState('');

    const handleTestMp = async (mpId: string) => {
        setTestingId(mpId);
        await new Promise(r => setTimeout(r, 1800));
        setTestingId(null);
        toast.success('Conexão validada com sucesso!');
    };

    const handleSaveMp = (mpId: string) => {
        setMarketplaces(prev => prev.map(m => m.id === mpId ? { ...m, affiliate_id: tempId, configured: !!tempId, last_validated: new Date().toISOString() } : m));
        setEditingMp(null);
        toast.success('ID de afiliado salvo!');
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
                        <Card className="p-6 md:col-span-2">
                            <h3 className="font-bold text-lg mb-6">Informações Pessoais</h3>
                            <div className="flex items-center gap-6 mb-8">
                                <Avatar className="w-20 h-20 border-2 border-primary/10">
                                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-black">JS</AvatarFallback>
                                </Avatar>
                                <div className="space-y-2">
                                    <Button variant="outline" size="sm">Alterar foto</Button>
                                    <p className="text-xs text-muted-foreground">Recomendado: JPG ou PNG, máx 2MB</p>
                                </div>
                            </div>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label>Nome completo</Label>
                                    <Input defaultValue="João Silva" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email</Label>
                                    <Input defaultValue="joao@synco.com" disabled className="bg-muted/50" />
                                </div>
                                <div className="space-y-2">
                                    <Label>WhatsApp</Label>
                                    <Input placeholder="+55 11 99999-9999" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Fuso horário</Label>
                                    <Select defaultValue="america_sp">
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="america_sp">América/São Paulo (UTC-3)</SelectItem>
                                            <SelectItem value="america_manaus">América/Manaus (UTC-4)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Button className="mt-8 font-bold" onClick={() => toast.success('Perfil salvo!')}>
                                <Save className="w-4 h-4 mr-2" /> Salvar Alterações
                            </Button>
                        </Card>

                        <Card className="p-6">
                            <h3 className="font-bold text-lg mb-6">Segurança</h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Senha atual</Label>
                                    <Input type="password" placeholder="••••••••" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Nova senha</Label>
                                    <Input type="password" placeholder="••••••••" />
                                </div>
                                <Button variant="outline" className="w-full font-bold" onClick={() => toast.success('Senha alterada!')}>
                                    <Shield className="w-4 h-4 mr-2" /> Alterar Senha
                                </Button>
                            </div>
                        </Card>

                        <Card className="p-6">
                            <h3 className="font-bold text-lg mb-6">Notificações</h3>
                            <div className="space-y-4">
                                {[
                                    { label: 'Automação executada', checked: true },
                                    { label: 'Campanha concluída', checked: true },
                                    { label: 'Falha de envio', checked: true },
                                    { label: 'Novo produto em alta', checked: false },
                                ].map(n => (
                                    <div key={n.label} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors">
                                        <span className="text-sm font-medium">{n.label}</span>
                                        <Switch defaultChecked={n.checked} />
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="affiliates" className="space-y-6 animate-in fade-in-50 duration-300">
                    <div className="grid md:grid-cols-2 gap-4">
                        {marketplaces.map(mp => (
                            <Card key={mp.id} className={`p-5 transition-all ${mp.configured ? 'border-primary/20 bg-primary/5' : 'border-dashed'}`}>
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <span className="text-3xl filter grayscale opacity-80">{mp.icon}</span>
                                        <div>
                                            <p className="font-bold text-sm tracking-tight">{mp.name}</p>
                                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{mp.description}</p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className={mp.configured ? 'text-[10px] bg-primary text-primary-foreground' : 'text-[10px] text-muted-foreground'}>
                                        {mp.configured ? 'CONFIGURADO' : 'PENDENTE'}
                                    </Badge>
                                </div>

                                {editingMp === mp.id ? (
                                    <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                                        <Input 
                                            value={tempId} 
                                            onChange={e => setTempId(e.target.value)} 
                                            placeholder="Cole seu ID de afiliado" 
                                            className="h-9 text-sm font-mono" 
                                            autoFocus 
                                        />
                                        <div className="flex gap-2">
                                            <Button size="sm" className="flex-1 font-bold" onClick={() => handleSaveMp(mp.id)}>Salvar</Button>
                                            <Button size="sm" variant="ghost" onClick={() => setEditingMp(null)}>Cancelar</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {mp.configured ? (
                                            <div className="px-3 py-2 rounded-lg bg-card border border-border/50 font-mono text-sm shadow-inner">
                                                {mp.affiliate_id}
                                            </div>
                                        ) : (
                                            <div className="px-3 py-2 rounded-lg bg-muted/20 border border-dashed text-xs text-muted-foreground italic text-center">
                                                Nenhum ID configurado
                                            </div>
                                        )}
                                        
                                        <div className="flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed">
                                            <HelpCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                            <span>{MARKETPLACE_HELP[mp.id] || 'Consulte o painel do parceiro.'}</span>
                                        </div>

                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" className="flex-1 font-bold text-xs"
                                                onClick={() => { setEditingMp(mp.id); setTempId(mp.affiliate_id || ''); }}>
                                                Configurar ID
                                            </Button>
                                            {mp.configured && (
                                                <Button size="sm" variant="ghost" onClick={() => handleTestMp(mp.id)} disabled={testingId === mp.id}>
                                                    {testingId === mp.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <TestTube className="w-3.5 h-3.5" />}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* tabsContent restantes seriam implementados similarmente seguindo o padrão SYNCO */}
                <TabsContent value="org" className="animate-in fade-in-50 duration-300">
                    <Card className="p-6 max-w-xl">
                        <h3 className="font-bold text-lg mb-6">Organização</h3>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Nome da organização</Label>
                                <Input defaultValue="Synco Affiliate Ops" />
                            </div>
                            <div className="space-y-2">
                                <Label>Slug (identificador na URL)</Label>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground font-mono">synco.app/</span>
                                    <Input defaultValue="synco-ops" className="font-mono h-8 text-xs" />
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/10">
                                <div className="space-y-1">
                                    <p className="text-sm font-bold">Plano Pro</p>
                                    <p className="text-xs text-muted-foreground">Próxima renovação em 12/04/2024</p>
                                </div>
                                <Button variant="ghost" size="sm" className="text-xs font-bold text-primary">Gerenciar Plano</Button>
                            </div>
                            <Button onClick={() => toast.success('Dados salvos!')} className="font-bold">
                                <Save className="w-4 h-4 mr-2" /> Salvar Organização
                            </Button>
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
