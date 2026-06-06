// src/components/automation/RouteCard.tsx
import React, { useState } from 'react';
import { AutomationRoute } from '@/types/automation';
import { TactileCard } from '@/components/ui/TactileCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Settings2, 
  Trash2, 
  MessageSquare, 
  Filter, 
  Target,
  ChevronDown,
  ChevronUp,
  Tag,
  Image as ImageIcon,
  Eye,
  Send
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CouponPreviewModal } from './CouponPreviewModal';
import { CouponTestModal } from './CouponTestModal';

interface RouteCardProps {
  route: AutomationRoute;
  targetName: string;
  onUpdate: (id: string, updates: Partial<AutomationRoute>) => void;
  onDelete: (id: string) => void;
}

export function RouteCard({ route, targetName, onUpdate, onDelete }: RouteCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localFilters, setLocalFilters] = useState(route.filters || {});
  const [localTemplate, setLocalTemplate] = useState(route.template_config?.body || '');
  const [localMediaUrl, setLocalMediaUrl] = useState(route.template_config?.media_url || '');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);

  const saveChanges = () => {
    onUpdate(route.id, {
      filters: localFilters,
      template_config: {
        ...route.template_config,
        body: localTemplate,
        media_url: localMediaUrl
      }
    });
  };

  return (
    <TactileCard className="group overflow-hidden border border-white/5 hover:border-white/10 transition-all duration-300">
      <div className="p-5 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-kinetic-orange/10 rounded-lg">
             <Target className="text-kinetic-orange" size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg">{targetName}</h3>
              <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest h-4">
                {route.target_type === 'group' ? 'Grupo' : 'Lista'}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 opacity-60">
               <span className="text-[10px] uppercase font-bold tracking-tight flex items-center gap-1">
                 <Filter size={10} /> {localFilters.min_price ? `R$ ${localFilters.min_price}+` : 'Sem min. preço'}
               </span>
               <span className="text-[10px] uppercase font-bold tracking-tight flex items-center gap-1">
                 <Tag size={10} /> {localFilters.min_commission_rate ? `${localFilters.min_commission_rate}%+` : 'Sem min. comissão'}
               </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-xs font-bold uppercase tracking-widest gap-2"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp size={14} /> : <Settings2 size={14} />} Configurações
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(route.id)}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      <div className={cn(
        "grid transition-all duration-500 ease-in-out",
        isExpanded ? "grid-rows-[1fr] opacity-100 p-6" : "grid-rows-[0fr] opacity-0"
      )}>
        <div className="overflow-hidden space-y-6">
          {/* Sessão de Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
               <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-kinetic-orange">
                  <Filter size={14} /> Filtros de Qualidade
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold opacity-60">Preço Mínimo (R$)</Label>
                    <Input 
                      type="number" 
                      placeholder="Ex: 50"
                      className="bg-white/5 border-white/10"
                      value={localFilters.min_price || ''}
                      onChange={(e) => setLocalFilters({...localFilters, min_price: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold opacity-60">Comissão Mínima (%)</Label>
                    <Input 
                      type="number" 
                      placeholder="Ex: 5"
                      className="bg-white/5 border-white/10"
                      value={localFilters.min_commission_rate || ''}
                      onChange={(e) => setLocalFilters({...localFilters, min_commission_rate: Number(e.target.value)})}
                    />
                  </div>
               </div>
            </div>

            <div className="space-y-4">
               <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-kinetic-orange">
                  <Filter size={14} /> Refino de Texto
               </div>
               <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold opacity-60">Keywords (Blacklist separada por vírgula)</Label>
                  <Input 
                    placeholder="recondicionado, usado, replica"
                    className="bg-white/5 border-white/10"
                    value={localFilters.keywords_blacklist?.join(', ') || ''}
                    onChange={(e) => setLocalFilters({
                      ...localFilters, 
                      keywords_blacklist: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    })}
                  />
               </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-kinetic-orange">
              <ImageIcon size={14} /> Mídia Padrão (Opcional)
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold opacity-60">URL da Imagem (.jpg, .png)</Label>
              <Input 
                placeholder="https://exemplo.com/imagem.png"
                className="bg-white/5 border-white/10"
                value={localMediaUrl}
                onChange={(e) => setLocalMediaUrl(e.target.value)}
              />
              {localMediaUrl && !localMediaUrl.startsWith('http') && (
                <div className="text-[10px] text-destructive">URL deve iniciar com http:// ou https://</div>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-kinetic-orange">
               <MessageSquare size={14} /> Template de Mensagem
            </div>
            <textarea 
              className="w-full min-h-[120px] bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-mono focus:outline-none focus:border-kinetic-orange/50 transition-colors"
              placeholder="Cole seu template aqui... Use {{titulo}}, {{preco}}, {{link}}..."
              value={localTemplate}
              onChange={(e) => setLocalTemplate(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
               {['{{titulo}}', '{{preco}}', '{{pix}}', '{{link}}', '{{loja}}', '{{grupo_origem}}'].map(tag => (
                 <button 
                  key={tag}
                  onClick={() => setLocalTemplate(localTemplate + ' ' + tag)}
                  className="text-[10px] font-bold bg-white/5 border border-white/10 px-2 py-1 rounded hover:bg-white/10 transition-colors"
                 >
                   {tag}
                 </button>
               ))}
            </div>
          </div>

          <div className="pt-4 flex justify-between items-center">
             <div className="flex gap-2">
               <Button 
                 variant="outline" 
                 size="sm" 
                 className="text-[10px] font-bold uppercase tracking-widest gap-2 bg-white/5 border-white/10 hover:bg-white/10"
                 onClick={() => setPreviewOpen(true)}
               >
                 <Eye size={14} /> Preview
               </Button>
               <Button 
                 variant="outline" 
                 size="sm" 
                 className="text-[10px] font-bold uppercase tracking-widest gap-2 bg-white/5 border-white/10 hover:bg-white/10 text-kinetic-orange hover:text-kinetic-orange/80 border-kinetic-orange/20"
                 onClick={() => setTestOpen(true)}
               >
                 <Send size={14} /> Enviar Teste
               </Button>
             </div>
             <Button 
               size="sm" 
               className="bg-kinetic-orange hover:bg-kinetic-orange/80 shadow-lg shadow-kinetic-orange/20 font-bold uppercase tracking-widest text-[10px]"
               onClick={saveChanges}
             >
               Salvar Regras da Rota
             </Button>
          </div>
        </div>
      </div>

      <CouponPreviewModal 
        isOpen={previewOpen} 
        onClose={() => setPreviewOpen(false)} 
        templateBody={localTemplate} 
        mediaUrl={localMediaUrl} 
      />

      <CouponTestModal 
        isOpen={testOpen} 
        onClose={() => setTestOpen(false)} 
        templateBody={localTemplate} 
        mediaUrl={localMediaUrl} 
      />
    </TactileCard>
  );
}
