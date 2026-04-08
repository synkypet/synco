'use client';

import React, { useState, useMemo } from 'react';
import { Plus, Search, Star, MessageSquare, Loader2, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Template, TemplateCategory, CATEGORY_LABELS } from '@/types/template';
import { useTemplates, useUpsertTemplate, useDeleteTemplate } from '@/hooks/use-templates';
import { useAuth } from '@/contexts/AuthContext';
import { TemplateCard } from '@/components/templates/TemplateCard';
import { TemplateModal } from '@/components/templates/TemplateModal';
import { cn } from '@/lib/utils';

export default function TemplatesPage() {
  const { user } = useAuth();
  const userId = user?.id;

  const { data: templates = [], isLoading } = useTemplates(userId);
  const upsertTemplate = useUpsertTemplate();
  
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || 
                           t.content.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
      const matchesFavorite = !showFavoritesOnly || t.is_favorite;
      
      return matchesSearch && matchesCategory && matchesFavorite;
    });
  }, [templates, search, activeCategory, showFavoritesOnly]);

  const handleCreate = () => {
    setEditingTemplate(null);
    setIsModalOpen(true);
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setIsModalOpen(true);
  };

  const handleSave = (data: any) => {
    upsertTemplate.mutate({
      ...data,
      id: editingTemplate?.id,
      user_id: userId
    }, {
      onSuccess: () => setIsModalOpen(false)
    });
  };

  const handleToggleFavorite = (template: Template) => {
    upsertTemplate.mutate({
      ...template,
      is_favorite: !template.is_favorite
    });
  };

  return (
    <div className="flex flex-col gap-8 p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-kinetic-orange shadow-glow-orange flex items-center justify-center">
                <MessageSquare className="text-white w-5 h-5" />
             </div>
             <h1 className="text-2xl font-black uppercase tracking-tighter font-headline text-white">Templates</h1>
          </div>
          <p className="text-xs font-bold text-white/20 uppercase tracking-widest px-1">Crie e gerencie seus modelos estrategicamente</p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            onClick={handleCreate}
            className="bg-kinetic-orange hover:bg-kinetic-orange/90 text-black font-black text-[10px] uppercase tracking-widest h-11 px-6 rounded-xl shadow-glow-orange/20 gap-2"
          >
            <Plus size={16} />
            Novo Template
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-6 bg-white/5 p-6 rounded-2xl shadow-skeuo-flat border border-white/5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex-1 max-w-md relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-kinetic-orange transition-colors" />
            <Input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome ou conteúdo..."
              className="bg-deep-void border-none h-12 pl-12 rounded-xl text-sm font-bold shadow-skeuo-pressed placeholder:text-white/10 placeholder:uppercase placeholder:tracking-widest placeholder:text-[10px]"
            />
          </div>

          <div className="flex items-center gap-3">
             <button
               onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
               className={cn(
                 "h-12 px-5 rounded-xl border border-transparent transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest",
                 showFavoritesOnly 
                  ? "bg-red-500/10 border-red-500/20 text-red-500 shadow-glow-orange/10" 
                  : "bg-deep-void text-white/40 hover:text-white shadow-skeuo-pressed"
               )}
             >
               <Star size={14} fill={showFavoritesOnly ? "currentColor" : "none"} />
               Favoritos
             </button>
             
             <div className="w-px h-8 bg-white/5 mx-2" />
             
             <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-auto">
               <TabsList className="bg-deep-void h-12 p-1.5 rounded-xl shadow-skeuo-pressed border-none">
                 <TabsTrigger value="all" className="h-full px-4 text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-kinetic-orange data-[state=active]:text-black rounded-lg transition-all">Todos</TabsTrigger>
                 <TabsTrigger value="promo" className="h-full px-4 text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-kinetic-orange data-[state=active]:text-black rounded-lg transition-all">Promoção</TabsTrigger>
                 <TabsTrigger value="coupon" className="h-full px-4 text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-kinetic-orange data-[state=active]:text-black rounded-lg transition-all">Cupom</TabsTrigger>
                 <TabsTrigger value="flash" className="h-full px-4 text-[9px] font-black uppercase tracking-widest data-[state=active]:bg-kinetic-orange data-[state=active]:text-black rounded-lg transition-all">Flash Sale</TabsTrigger>
               </TabsList>
             </Tabs>
          </div>
        </div>
      </div>

      {/* Grid Section */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-20">
          <Loader2 className="w-8 h-8 animate-spin text-kinetic-orange" />
          <span className="text-[10px] font-black uppercase tracking-widest">Sincronizando modelos...</span>
        </div>
      ) : filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredTemplates.map(template => (
            <TemplateCard 
              key={template.id} 
              template={template} 
              onEdit={handleEdit}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 rounded-3xl bg-white/5 border border-dashed border-white/10 text-center">
            <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center mb-6 shadow-skeuo-flat">
               <Filter className="w-6 h-6 text-white/10" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-widest text-white/40 mb-2">Nenhum template encontrado</h3>
            <p className="text-[10px] font-bold text-white/10 uppercase tracking-widest">Ajuste seus filtros ou crie um novo modelo estratégico.</p>
        </div>
      )}

      {/* Template Modal */}
      <TemplateModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        initialData={editingTemplate}
        isSubmitting={upsertTemplate.isPending}
      />
    </div>
  );
}
