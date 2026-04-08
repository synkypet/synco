import React from 'react';
import { Template, CATEGORY_LABELS } from '@/types/template';
import { TactileCard } from '@/components/ui/TactileCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit2, Heart, MessageSquare, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { templateService } from '@/services/supabase/template-service';

interface TemplateCardProps {
  template: Template;
  onEdit: (template: Template) => void;
  onToggleFavorite: (template: Template) => void;
}

export function TemplateCard({ template, onEdit, onToggleFavorite }: TemplateCardProps) {
  // Preview simples: remove tags para o resumo
  const previewText = template.content
    .replace(/\{.*?\}/g, '...')
    .substring(0, 120);

  return (
    <TactileCard className="p-0 overflow-hidden border-none group animate-in fade-in duration-500">
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shadow-skeuo-flat">
              <MessageSquare className="w-4 h-4 text-orange-400" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-xs font-black uppercase tracking-widest text-white/90 group-hover:text-kinetic-orange transition-colors">
                {template.name}
              </h3>
              <Badge variant="outline" className="w-fit bg-white/5 border-none text-[8px] font-black uppercase tracking-widest mt-1 h-5">
                {CATEGORY_LABELS[template.category]}
              </Badge>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-white/20 hover:text-white"
          >
            <MoreHorizontal size={16} />
          </Button>
        </div>

        {/* Preview Panel */}
        <div className="bg-deep-void/50 rounded-xl p-4 min-h-[100px] shadow-skeuo-pressed border border-white/5 group-hover:border-kinetic-orange/20 transition-all duration-500">
          <p className="text-[10px] font-mono leading-relaxed text-white/40 italic">
            {previewText}...
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-[10px] font-bold text-white/20 uppercase tracking-tighter">
            Usado {template.usage_count}x
          </span>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onToggleFavorite(template)}
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                template.is_favorite 
                  ? "text-red-500 bg-red-500/10 shadow-glow-orange/10" 
                  : "text-white/20 hover:text-white hover:bg-white/5"
              )}
            >
              <Heart size={14} fill={template.is_favorite ? "currentColor" : "none"} />
            </button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onEdit(template)}
              className="h-8 gap-2 bg-white/5 border-none text-[10px] font-black uppercase tracking-widest hover:bg-kinetic-orange/10 hover:text-kinetic-orange"
            >
              <Edit2 size={12} />
              Editar
            </Button>
          </div>
        </div>
      </div>
    </TactileCard>
  );
}
