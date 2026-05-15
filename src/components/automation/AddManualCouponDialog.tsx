'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { KineticButton } from '@/components/ui/KineticButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Search, Check, AlertTriangle, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { TactileCard } from '@/components/ui/TactileCard';
import { Badge } from '@/components/ui/badge';

interface AddManualCouponDialogProps {
  sourceId: string;
  routeId: string;
  onSuccess: () => void;
}

export function AddManualCouponDialog({ sourceId, routeId, onSuccess }: AddManualCouponDialogProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleValidate = async () => {
    if (!input.trim()) return;
    
    setIsValidating(true);
    setPreview(null);
    
    try {
      const response = await fetch('/api/shopee/automation-coupons/validate-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao validar input');
      }
      
      setPreview(data);
      if (data.status === 'invalid') {
        toast.error('Este link não parece ser um cupom ou página promocional Shopee válida.');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    if (!preview || preview.status === 'invalid') return;
    
    setIsSaving(true);
    try {
      // 1. Criar o registro de descoberta (ou obter se já existe)
      // Nota: No MVP, o backend handleSyncRules já cuida disso se viéssemos de captura.
      // Para manual, o ideal seria o backend processar e salvar.
      // Vamos usar uma rota de upsert de regra que aceita os dados brutos ou ID.
      
      const response = await fetch('/api/shopee/automation-coupons/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          payload: {
            rule: {
              source_id: sourceId,
              route_id: routeId,
              item_type: preview.status,
              // No backend, se item_type for coupon, ele deve garantir que discovered_coupons tenha o item
              // Para simplificar, o backend de rules pode receber os metadados e criar o discovered_coupon se necessário.
              // Mas aqui vamos assumir que o sync ou captura já aconteceu se o item existe, 
              // ou o backend de upsert lida com a criação do discovered_coupon.
              
              // Ajuste: Vamos enviar o link final para o backend lidar
              _manual_input: input,
              is_selected: true,
              is_active: true,
              interval_minutes: 60
            }
          }
        })
      });

      if (!response.ok) throw new Error('Erro ao salvar regra');
      
      toast.success('Cupom adicionado com sucesso!');
      setOpen(false);
      setInput('');
      setPreview(null);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 bg-anthracite-surface border-none text-white hover:bg-deep-void shadow-skeuo-flat">
          <Plus className="w-4 h-4" />
          Adicionar Manualmente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-deep-void border-none shadow-skeuo-elevated">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">Adicionar Cupom Shopee</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="coupon-input" className="text-gray-400">Link ou Texto do Cupom</Label>
            <div className="flex gap-2">
              <Input
                id="coupon-input"
                placeholder="Cole o link s.shopee.com.br... ou o texto da oferta"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="bg-anthracite-surface border-none text-white focus-visible:ring-kinetic-orange"
              />
              <Button 
                onClick={handleValidate} 
                disabled={isValidating || !input.trim()}
                variant="secondary"
                size="icon"
                className="w-10 h-10 bg-anthracite-surface border-none text-white hover:text-kinetic-orange"
              >
                {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {preview && preview.status !== 'invalid' && (
            <TactileCard className="p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex gap-4">
                <div className="w-20 h-20 rounded-lg bg-deep-void flex items-center justify-center overflow-hidden flex-shrink-0">
                  {preview.preview.image ? (
                    <img src={preview.preview.image} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-gray-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Badge variant="outline" className="mb-1 text-[10px] border-kinetic-orange text-kinetic-orange">
                    {preview.status === 'coupon' ? 'CUPOM' : 'PROMO PAGE'}
                  </Badge>
                  <h4 className="text-white font-medium text-sm truncate">{preview.preview.title}</h4>
                  <div className="text-kinetic-orange font-bold text-lg">
                    {preview.preview.priceFormatted || 'Resgate Grátis'}
                  </div>
                  {preview.preview.discountPercent > 0 && (
                    <div className="text-green-500 text-xs font-medium">
                      -{preview.preview.discountPercent}% OFF
                    </div>
                  )}
                </div>
              </div>

              {preview.preview.coupons?.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-[10px] text-gray-500 uppercase tracking-wider">Cupons Detectados</Label>
                  <div className="flex flex-wrap gap-2">
                    {preview.preview.coupons.map((c: any, idx: number) => (
                      <div key={idx} className="bg-deep-void px-2 py-1 rounded border border-gray-800 text-[11px] text-gray-300 font-mono">
                        {c.code || 'Link de Resgate'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <Label className="text-[10px] text-gray-500 uppercase tracking-wider">Prévia da Mensagem</Label>
                <div className="mt-1 p-2 bg-deep-void rounded text-[11px] text-gray-400 whitespace-pre-wrap max-h-32 overflow-y-auto font-mono">
                  {preview.preview.messagePreview}
                </div>
              </div>
            </TactileCard>
          )}

          {preview && preview.status === 'invalid' && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex gap-3 text-red-400 text-sm italic">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              Nenhum cupom ou promoção válida encontrada neste conteúdo.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="ghost" 
            onClick={() => setOpen(false)}
            className="text-gray-400 hover:text-white hover:bg-transparent"
          >
            Cancelar
          </Button>
          <KineticButton 
            onClick={handleSave}
            disabled={!preview || preview.status === 'invalid' || isSaving}
            className="gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Salvar Regra
          </KineticButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
