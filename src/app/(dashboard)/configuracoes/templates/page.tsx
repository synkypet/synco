"use client";

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Plus, Edit2, Trash2, Copy, Sparkles, AlertCircle, 
  CheckCircle2, Info, ArrowLeft, RefreshCw, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { MessageTemplate, MessageTemplateUserSettings, templateService } from '@/services/supabase/template-service';
import PageHeader from '@/components/shared/PageHeader';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const PREVIEW_DATA = {
  titulo: "Fone Bluetooth Premium X10",
  titulo_maiusculo: "FONE BLUETOOTH PREMIUM X10",
  link: "https://s.shopee.com.br/exemplo",
  preco: "89,90",
  preco_original: "149,90",
  desconto: "40",
  loja: "Shopee Mall",
  valor: "20,00",
  minimo: "150,00",
  frete_minimo: "19,00",
  codigo: "SHOPEE20"
};

export default function TemplatesPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<'product' | 'coupon' | 'campaign'>('product');
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [userSettings, setUserSettings] = useState<MessageTemplateUserSettings[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<MessageTemplate> | null>(null);

  useEffect(() => {
    if (user) {
      fetchTemplates();
    }
  }, [user]);

  const fetchTemplates = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { templates: tData, settings: sData } = await templateService.listManagedTemplates(supabase, user.id);
      setTemplates(tData);
      setUserSettings(sData);
    } catch (err: any) {
      toast.error('Erro ao buscar templates: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingTemplate?.name || !editingTemplate?.content) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    try {
      const payload = {
        ...editingTemplate,
        user_id: user?.id,
        category: activeTab,
        template_type: editingTemplate.template_type || (activeTab === 'product' ? 'shopee_product' : activeTab === 'coupon' ? 'shopee_coupon' : 'shopee_promo_landing'),
        is_active: editingTemplate.is_active ?? true,
      };

      await templateService.upsert(supabase, payload);
      toast.success(editingTemplate.id ? 'Template atualizado!' : 'Template criado!');

      setIsDialogOpen(false);
      setEditingTemplate(null);
      fetchTemplates();
    } catch (err: any) {
      toast.error('Erro ao salvar template: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (!confirm('Tem certeza que deseja excluir este template?')) return;

    try {
      await templateService.delete(supabase, id, user.id);
      toast.success('Template excluído!');
      fetchTemplates();
    } catch (err: any) {
      if (err.message === 'system_template_cannot_be_deleted') {
        toast.error('Templates de sistema não podem ser excluídos.');
      } else {
        toast.error('Erro ao excluir: ' + err.message);
      }
    }
  };

  const toggleUserTemplateActive = async (template: MessageTemplate) => {
    if (!user) return;
    try {
      const newActive = !template.is_active;
      await templateService.upsert(supabase, { ...template, is_active: newActive });
      
      // Se desativou e era o ativo, o service já deve ter tratado ou trataremos aqui
      fetchTemplates();
      toast.success(newActive ? 'Template ativado!' : 'Template pausado');
    } catch (err: any) {
      toast.error('Erro ao alterar status: ' + err.message);
    }
  };

  const toggleSystemTemplate = async (template: MessageTemplate) => {
    if (!user) return;
    const setting = userSettings.find(s => s.template_type === template.template_type);
    const currentlyEnabled = setting?.system_template_enabled ?? true;

    try {
      await templateService.toggleSystemTemplate(supabase, user.id, template.template_type, !currentlyEnabled);
      fetchTemplates();
      toast.success(!currentlyEnabled ? 'Padrão do sistema reativado!' : 'Padrão do sistema desativado');
    } catch (err: any) {
      if (err.message === 'default_template_requires_active_user_template') {
        toast.error('Crie ou ative um template próprio para este tipo antes de desativar o padrão.');
      } else {
        toast.error('Erro ao alterar status: ' + err.message);
      }
    }
  };

  const setAsActiveForType = async (template: MessageTemplate) => {
    if (!user) return;
    try {
      await templateService.setActiveUserTemplate(supabase, user.id, template.template_type, template.id);
      fetchTemplates();
      toast.success('Este template agora é o preferencial para este tipo!');
    } catch (err: any) {
      toast.error('Erro ao definir como ativo: ' + err.message);
    }
  };


  const handleClone = (template: MessageTemplate) => {
    setEditingTemplate({
      name: `${template.name} (Cópia)`,
      content: template.content,
      category: template.category,
      template_type: template.template_type,
      is_active: true
    });
    setIsDialogOpen(true);
  };

  const userTemplates = templates.filter(t => t.category === activeTab && !t.is_system);
  const systemTemplates = templates.filter(t => t.category === activeTab && t.is_system);

  const getTemplateStatus = (template: MessageTemplate) => {
    if (template.is_system) {
      const setting = userSettings.find(s => s.template_type === template.template_type);
      return setting?.system_template_enabled !== false;
    } else {
      const setting = userSettings.find(s => s.template_type === template.template_type);
      return setting?.active_user_template_id === template.id;
    }
  };


  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 lg:px-12 py-4">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/configuracoes">
          <Button variant="ghost" size="sm" className="rounded-full h-10 w-10 p-0 hover:bg-white/5">
            <ArrowLeft className="w-5 h-5 text-white/40" />
          </Button>
        </Link>
        <PageHeader 
          title="Templates de Mensagem" 
          description="Personalize o layout das suas mensagens para WhatsApp e sorteie entre os estilos ativos" 
        />
      </div>

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList className="bg-muted/30 p-1 rounded-xl h-auto gap-1 border border-white/5 shadow-skeuo-pressed">
            <TabsTrigger value="product" className="text-[10px] uppercase font-black tracking-widest gap-2 rounded-lg">📦 Produtos</TabsTrigger>
            <TabsTrigger value="coupon" className="text-[10px] uppercase font-black tracking-widest gap-2 rounded-lg">🎟️ Cupons</TabsTrigger>
            <TabsTrigger value="campaign" className="text-[10px] uppercase font-black tracking-widest gap-2 rounded-lg">⚡ Campanhas</TabsTrigger>
          </TabsList>

          <Button 
            onClick={() => {
              setEditingTemplate({ is_active: true });
              setIsDialogOpen(true);
            }}
            className="bg-kinetic-orange text-black hover:bg-kinetic-orange/90 font-black uppercase tracking-widest text-[10px] h-10 rounded-xl shadow-glow-orange/20"
          >
            <Plus className="w-4 h-4 mr-2" /> Novo Template
          </Button>
        </div>

        {/* Templates do Usuário */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {isLoading ? (
            <div className="lg:col-span-2 py-20 flex justify-center opacity-30">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
          ) : userTemplates.length > 0 ? (
            userTemplates.map(template => (
              <TemplateCard 
                key={template.id} 
                template={template} 
                isInUse={getTemplateStatus(template)}
                onEdit={() => {
                  setEditingTemplate(template);
                  setIsDialogOpen(true);
                }}
                onDelete={() => handleDelete(template.id)}
                onToggle={() => toggleUserTemplateActive(template)}
                onSetAsActive={() => setAsActiveForType(template)}
              />
            ))
          ) : (
            <div className="lg:col-span-2 p-12 text-center rounded-[32px] border border-dashed border-white/5 bg-white/[0.02]">
              <Sparkles className="w-10 h-10 mx-auto mb-4 text-white/10" />
              <p className="text-[11px] font-black uppercase tracking-widest text-white/20">Você ainda não criou templates personalizados para esta categoria.</p>
              <p className="text-[9px] text-white/10 mt-2 uppercase">O sistema usará os templates padrão.</p>
            </div>
          )}
        </div>

        {/* Templates Padrão (Colapsável) */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-px bg-white/5 flex-1" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Templates Padrão do Sistema</span>
            <div className="h-px bg-white/5 flex-1" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {systemTemplates.map(template => {
              const isEnabled = getTemplateStatus(template);
              return (
                <Card key={template.id} className={cn(
                  "p-5 border-none bg-anthracite-surface/30 ring-1 ring-white/5 relative overflow-hidden group transition-all duration-300",
                  !isEnabled && "opacity-40 grayscale"
                )}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h5 className="font-bold text-xs uppercase tracking-wider text-white/80">{template.name}</h5>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="border-none bg-white/5 text-[8px] uppercase tracking-tighter">Somente Leitura</Badge>
                        {isEnabled && (
                          <Badge variant="outline" className="border-none bg-emerald-500/10 text-emerald-500 text-[8px] uppercase tracking-tighter">Em Uso</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 rounded-lg hover:bg-kinetic-orange/10 hover:text-kinetic-orange"
                        onClick={() => handleClone(template)}
                        title="Usar como base (Duplicar)"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="bg-black/40 p-4 rounded-xl text-[10px] font-mono text-white/40 whitespace-pre-wrap leading-relaxed max-h-32 overflow-hidden italic">
                    {template.content}
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <Switch checked={isEnabled} onCheckedChange={() => toggleSystemTemplate(template)} />
                       <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Ativo</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

      </Tabs>

      {/* Modal de Criação/Edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl bg-anthracite-surface border-white/5 shadow-skeuo-elevated rounded-[32px] p-0 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* Formulário */}
            <div className="p-8 space-y-6">
              <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase font-headline italic italic">
                  {editingTemplate?.id ? 'Editar Template' : 'Novo Template'}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">Nome do Layout</Label>
                  <Input 
                    placeholder="Ex: Urgência com Emojis"
                    className="bg-deep-void border-none shadow-skeuo-pressed h-11 rounded-xl"
                    value={editingTemplate?.name || ''}
                    onChange={e => setEditingTemplate(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">Conteúdo do Template</Label>
                    <Badge variant="outline" className="border-none bg-white/5 text-[8px] uppercase">Markdown Suportado</Badge>
                  </div>
                  <Textarea 
                    placeholder="Use {{titulo}}, {{link}}, {{preco}}, {{preco_original}}, {{desconto}}, {{comissao}}, {{loja}}"
                    className="bg-deep-void border-none shadow-skeuo-pressed min-h-[200px] rounded-xl font-mono text-xs leading-relaxed resize-none"
                    value={editingTemplate?.content || ''}
                    onChange={e => setEditingTemplate(prev => ({ ...prev, content: e.target.value }))}
                  />
                  <div className="flex flex-wrap gap-2 pt-2">
                    {['titulo', 'titulo_maiusculo', 'link', 'preco', 'preco_original', 'desconto', 'loja', 'valor', 'minimo', 'frete_minimo', 'codigo'].map(tag => (
                      <button 
                        key={tag}
                        onClick={() => setEditingTemplate(prev => ({ ...prev, content: (prev?.content || '') + `{{${tag}}}` }))}
                        className="text-[9px] font-black uppercase tracking-widest px-2 py-1 bg-white/5 hover:bg-white/10 rounded-md text-white/40 transition-all border border-white/[0.02]"
                      >
                        +{tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between bg-black/20 p-4 rounded-2xl border border-white/5">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-white/60">Template Ativo</Label>
                    <p className="text-[9px] text-white/20 uppercase">Se desativado, o sistema não usará este layout no sorteio.</p>
                  </div>
                  <Switch 
                    checked={editingTemplate?.is_active ?? true}
                    onCheckedChange={val => setEditingTemplate(prev => ({ ...prev, is_active: val }))}
                  />
                </div>
              </div>

              <DialogFooter className="pt-4">
                <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="text-[10px] font-black uppercase tracking-widest h-11 px-6 rounded-xl">Cancelar</Button>
                <Button 
                  onClick={handleSave}
                  className="bg-kinetic-orange text-black hover:bg-kinetic-orange/90 font-black uppercase tracking-widest text-[10px] h-11 px-8 rounded-xl shadow-glow-orange/20"
                >
                  <SaveIcon className="w-4 h-4 mr-2" /> {editingTemplate?.id ? 'Atualizar Layout' : 'Criar Layout'}
                </Button>
              </DialogFooter>
            </div>

            {/* Preview Lateral */}
            <div className="bg-deep-void/50 p-8 border-l border-white/5">
              <div className="flex items-center gap-2 mb-6 text-kinetic-orange/60">
                <Eye className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Preview em Tempo Real</span>
              </div>

              <div className="relative">
                {/* Mockup WhatsApp */}
                <div className="bg-[#0b141a] rounded-3xl p-6 shadow-2xl border border-white/5 max-w-[320px] mx-auto min-h-[400px] relative">
                   <div className="bg-[#dcf8c6] text-[#111b21] p-3 rounded-tr-xl rounded-bl-xl rounded-br-xl text-[12px] shadow-sm relative whitespace-pre-wrap leading-tight font-sans">
                      {editingTemplate?.content 
                        ? templateService.render(editingTemplate.content, PREVIEW_DATA)
                        : "Digite algo no template para ver o preview..."
                      }
                      <div className="text-[9px] text-[#667781] text-right mt-1">20:45 ✓✓</div>
                      {/* Triângulo do balão */}
                      <div className="absolute top-0 -left-2 w-0 h-0 border-t-[8px] border-t-[#dcf8c6] border-l-[8px] border-l-transparent" />
                   </div>
                </div>

                <div className="mt-8 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex gap-3">
                  <Info className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-[9px] text-amber-500/60 uppercase font-black leading-relaxed">
                    Nota: O WhatsApp não suporta Markdown real, apenas *negrito*, ~tachado~ e _itálico_. Use estas tags para estilizar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplateCard({ template, isInUse, onEdit, onDelete, onToggle, onSetAsActive }: { 
  template: MessageTemplate, 
  isInUse: boolean,
  onEdit: () => void, 
  onDelete: () => void,
  onToggle: () => void,
  onSetAsActive: () => void
}) {
  return (
    <Card className={cn(
      "p-6 border-none bg-anthracite-surface ring-1 ring-white/5 shadow-skeuo-flat transition-all duration-300 group",
      !template.is_active && "opacity-60"
    )}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shadow-skeuo-flat border transition-all",
            template.is_active ? "bg-kinetic-orange/10 border-kinetic-orange/20 text-kinetic-orange" : "bg-white/5 border-white/10 text-white/20"
          )}>
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm tracking-tight text-white/90">{template.name}</h4>
              {isInUse && (
                <Badge variant="outline" className="border-none bg-emerald-500/10 text-emerald-500 text-[7px] uppercase px-1 py-0 h-4">Em Uso</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={cn(
                "border-none text-[8px] font-black uppercase tracking-widest px-2 py-0.5",
                template.is_active ? "bg-emerald-500/10 text-emerald-500" : "bg-white/5 text-white/20"
              )}>
                {template.is_active ? 'Ativo no sorteio' : 'Pausado'}
              </Badge>
              <span className="text-[8px] text-white/10 uppercase font-black tracking-tighter">Criado em {new Date(template.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 w-8 p-0 rounded-lg hover:bg-white/5">
            <Edit2 className="w-4 h-4 text-white/40" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 w-8 p-0 rounded-lg hover:bg-red-500/10 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="bg-black/30 p-5 rounded-2xl text-[11px] font-mono text-white/30 whitespace-pre-wrap leading-relaxed shadow-skeuo-pressed border border-white/[0.02]">
        {template.content}
      </div>

      <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
           <Switch checked={template.is_active} onCheckedChange={onToggle} />
           <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Status Operacional</span>
        </div>
        
        {template.is_active && !isInUse && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onSetAsActive}
            className="text-[9px] font-black uppercase tracking-widest h-8 px-3 rounded-lg bg-white/5 hover:bg-kinetic-orange/20 hover:text-kinetic-orange"
          >
            Usar este
          </Button>
        )}

        <Badge variant="outline" className="h-5 bg-white/5 border-none text-[8px] font-black uppercase tracking-widest text-white/20">
          Type: {template.template_type}
        </Badge>
      </div>
    </Card>
  );
}


function SaveIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
