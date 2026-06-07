'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { KineticButton } from '@/components/ui/KineticButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Check, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface AddManualCouponDialogProps {
  sourceId: string;
  routeId: string;
  onSuccess: () => void;
  couponToEdit?: any; // Se passado, funciona como modo de edição ou clone
  isClone?: boolean; // Se true, o botão exibe 'Clonar'
}

export function AddManualCouponDialog({ sourceId, routeId, onSuccess, couponToEdit, isClone }: AddManualCouponDialogProps) {
  const [open, setOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    coupon_label: couponToEdit?.coupon_label || couponToEdit?.custom_title || '',
    code: couponToEdit?.code || '',
    custom_description: couponToEdit?.custom_description || couponToEdit?.raw_text || '',
    redemption_url: couponToEdit?.redemption_url || '',
    image_url: couponToEdit?.image_url || ''
  });

  const [isSaving, setIsSaving] = useState(false);

  const isEdit = !!couponToEdit && !isClone;

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.coupon_label && !formData.custom_description && !formData.code && !formData.redemption_url) {
      toast.error('Preencha pelo menos um campo para criar o cupom.');
      return;
    }
    
    setIsSaving(true);
    try {
      // 1. Criar ou Atualizar na base global (discovered_coupons)
      const action = isEdit ? 'update' : 'create';
      const payload = isEdit ? { ...formData, id: couponToEdit.id } : formData;

      const response = await fetch('/api/shopee/discovered-coupons/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao processar cupom manual');
      
      const newCoupon = data.coupon;

      // 2. Se for criação, adicionar à automação ativa
      if (!isEdit && newCoupon) {
        const ruleRes = await fetch('/api/shopee/automation-coupons/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'upsert',
            payload: {
              rule: {
                source_id: sourceId,
                route_id: routeId,
                coupon_id: newCoupon.id,
                item_type: 'coupon',
                is_selected: true,
                is_active: true,
                interval_minutes: 60
              }
            }
          })
        });

        if (!ruleRes.ok) throw new Error('Criado com sucesso, mas erro ao adicionar à rota');
      }
      
      toast.success(isEdit ? 'Cupom atualizado!' : 'Cupom criado e adicionado à automação!');
      setOpen(false);
      if (!isEdit) {
        setFormData({
          coupon_label: '',
          code: '',
          custom_description: '',
          redemption_url: '',
          image_url: ''
        });
      }
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
        {isEdit ? (
          <Button variant="outline" size="sm" className="h-7 text-[10px]">
            Editar
          </Button>
        ) : isClone ? (
          <Button variant="outline" size="sm" className="h-7 text-[10px]">
            Clonar para Biblioteca
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-2 bg-anthracite-surface border-none text-white hover:bg-deep-void shadow-skeuo-flat">
            <Plus className="w-4 h-4" />
            Novo Cupom Manual
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-deep-void border-none shadow-skeuo-elevated text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{isEdit ? 'Editar Cupom' : isClone ? 'Clonar Cupom' : 'Criar Cupom Manual'}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-gray-400">Título / Título da Oferta</Label>
            <Input
              value={formData.coupon_label}
              onChange={(e) => handleChange('coupon_label', e.target.value)}
              className="bg-anthracite-surface border-none focus-visible:ring-kinetic-orange"
              placeholder="Ex: 50% OFF em Eletrônicos"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-400">Código do Cupom (Opcional)</Label>
            <Input
              value={formData.code}
              onChange={(e) => handleChange('code', e.target.value)}
              className="bg-anthracite-surface border-none focus-visible:ring-kinetic-orange font-mono"
              placeholder="Ex: ELETRONICOS50"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-400">Descrição Customizada / Regras</Label>
            <Textarea
              value={formData.custom_description}
              onChange={(e) => handleChange('custom_description', e.target.value)}
              className="bg-anthracite-surface border-none focus-visible:ring-kinetic-orange min-h-[80px]"
              placeholder="Ex: Válido apenas hoje para compras acima de R$100..."
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-400">Link de Resgate</Label>
            <Input
              value={formData.redemption_url}
              onChange={(e) => handleChange('redemption_url', e.target.value)}
              className="bg-anthracite-surface border-none focus-visible:ring-kinetic-orange"
              placeholder="https://s.shopee.com.br/..."
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-400">URL da Imagem (Pública HTTPS)</Label>
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <Input
                  value={formData.image_url}
                  onChange={(e) => handleChange('image_url', e.target.value)}
                  className="bg-anthracite-surface border-none focus-visible:ring-kinetic-orange"
                  placeholder="https://..."
                />
              </div>
              {formData.image_url && (
                <div className="w-10 h-10 rounded overflow-hidden bg-anthracite-surface shrink-0 flex items-center justify-center">
                  <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
                </div>
              )}
            </div>
          </div>
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
            disabled={isSaving}
            className="gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isEdit ? 'Salvar Alterações' : 'Salvar e Adicionar'}
          </KineticButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
