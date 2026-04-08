import React, { useState, useEffect, useRef } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Heart, Sparkles, Code2, Layout, BookOpen, Loader2 } from 'lucide-react';
import { Template, TemplateCategory, CATEGORY_LABELS } from '@/types/template';
import { templateService } from '@/services/supabase/template-service';
import { CTALibraryModal } from './CTALibraryModal';
import { cn } from '@/lib/utils';

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: Template | null;
  isSubmitting?: boolean;
}

const AVAILABLE_TAGS = [
  { id: 'produto_nome', label: '{produto_nome}' },
  { id: 'preco_original', label: '{preco_original}' },
  { id: 'preco_atual', label: '{preco_atual}' },
  { id: 'desconto_percentual', label: '{desconto_percentual}' },
  { id: 'valor_economizado', label: '{valor_economizado}' },
  { id: 'cupom', label: '{cupom}' },
  { id: 'link_afiliado', label: '{link_afiliado}' },
  { id: 'loja', label: '{loja}' },
  { id: 'score', label: '{score}' },
  { id: 'comissao_percentual', label: '{comissao_percentual}' }
];

export function TemplateModal({ isOpen, onClose, onSave, initialData, isSubmitting }: TemplateModalProps) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('general');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isCTALibraryOpen, setIsCTALibraryOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setContent(initialData.content);
      setCategory(initialData.category);
      setIsFavorite(initialData.is_favorite);
    } else {
      setName('');
      setContent('');
      setCategory('general');
      setIsFavorite(false);
    }
  }, [initialData, isOpen]);

  const insertTag = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = content.substring(0, start) + tag + content.substring(end);
    
    setContent(newText);
    
    // Devolve o foco e posiciona no final da tag
    setTimeout(() => {
      textarea.focus();
      const newPos = start + tag.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 10);
  };

  const handleSave = () => {
    onSave({
      name,
      content,
      category,
      is_favorite: isFavorite
    });
  };

  const previewContent = templateService.renderTemplate(content, {});

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl bg-deep-void border-white/5 shadow-skeuo-elevated p-0 overflow-hidden animate-in zoom-in-95 duration-300 h-[85vh] flex flex-col">
        <DialogHeader className="p-6 border-b border-white/5 bg-gradient-to-br from-white/5 to-transparent flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-kinetic-orange/10 flex items-center justify-center shadow-skeuo-flat">
                <Layout className="w-5 h-5 text-kinetic-orange" />
              </div>
              <div>
                <DialogTitle className="text-sm font-black uppercase tracking-widest font-headline">
                  {initialData ? 'Editar Template' : 'Novo Template'}
                </DialogTitle>
                <p className="text-[10px] uppercase text-white/20 font-bold">Configure sua estrutura de mensagem principal</p>
              </div>
            </div>
            <button 
              onClick={() => setIsFavorite(!isFavorite)}
              className={cn(
                "p-2 rounded-lg transition-all",
                isFavorite ? "text-red-500 bg-red-500/10 shadow-glow-orange/10" : "text-white/20 hover:text-white"
              )}
            >
              <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Lado Esquerdo: Editor */}
          <div className="w-full md:w-[60%] p-8 overflow-y-auto space-y-6 custom-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/30">Nome identificador</label>
                <Input 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Oferta de Natal"
                  className="bg-deep-void shadow-skeuo-pressed border-none h-11 text-sm font-bold placeholder:text-white/10"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/30">Categoria</label>
                <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                  <SelectTrigger className="bg-deep-void shadow-skeuo-pressed border-none h-11 text-xs font-black uppercase tracking-widest text-white/70">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-deep-void border-white/5 text-white/70 text-xs font-bold uppercase tracking-widest">
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/30">Corpo da mensagem</label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsCTALibraryOpen(true)}
                  className="h-8 gap-2 bg-kinetic-orange/10 border-none text-[8px] font-black uppercase tracking-widest text-kinetic-orange hover:bg-kinetic-orange/20"
                >
                  <BookOpen size={12} />
                  Biblioteca CTA
                </Button>
              </div>
              <div className="relative group">
                <Textarea 
                  ref={textareaRef}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Comece a digitar seu modelo..."
                  className="min-h-[280px] bg-deep-void shadow-skeuo-pressed border-none text-xs font-mono p-5 rounded-2xl resize-none leading-relaxed transition-all focus-visible:ring-1 focus-visible:ring-kinetic-orange/30 placeholder:text-white/5"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/20">
                <Code2 size={12} />
                Tags Dinâmicas (Clique para inserir)
              </div>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_TAGS.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => insertTag(tag.label)}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-transparent hover:border-kinetic-orange/20 hover:bg-kinetic-orange/10 hover:text-kinetic-orange text-[9px] font-black uppercase tracking-tight text-white/40 transition-all font-mono"
                  >
                    {tag.label.replace(/[\{\}]/g, '')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Lado Direito: Preview */}
          <div className="flex-1 bg-black/20 p-8 flex flex-col items-center">
            <div className="w-full max-w-[340px] flex flex-col gap-3">
               <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-4 bg-kinetic-orange rounded-full" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/30 italic">Visão do Usuário Final</span>
               </div>
               
               <div className="bg-deep-void shadow-skeuo-elevated rounded-2xl p-6 min-h-[400px] border border-white/5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-kinetic-orange/5 blur-3xl rounded-full pointer-events-none group-hover:bg-kinetic-orange/10 transition-all" />
                  
                  {!content.trim() ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                      <Sparkles className="w-8 h-8 mb-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">
                        Escreva no editor para<br/>ver a magia acontecer
                      </p>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap text-[11px] font-bold leading-relaxed text-white/80 animate-in fade-in duration-300">
                      {previewContent}
                    </div>
                  )}
               </div>
               
               <p className="text-[9px] font-bold uppercase text-white/10 text-center mt-4 tracking-widest">
                 Dica: Imagem do produto será adicionada automaticamente no topo do disparo.
               </p>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 bg-black/20 gap-3 border-t border-white/5 flex-shrink-0">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="h-12 px-8 font-black text-[10px] uppercase tracking-widest text-white/40 hover:text-white"
          >
            Descartar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isSubmitting || !name || !content}
            className="h-12 px-10 bg-kinetic-orange hover:bg-kinetic-orange/90 text-black font-black text-[10px] uppercase tracking-widest shadow-glow-orange/30 disabled:opacity-50"
          >
            {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : 'Salvar Template'}
          </Button>
        </DialogFooter>

        <CTALibraryModal 
          isOpen={isCTALibraryOpen} 
          onClose={() => setIsCTALibraryOpen(false)} 
          onSelectHeader={(text) => insertTag(`\n${text}\n`)}
        />
      </DialogContent>
    </Dialog>
  );
}
