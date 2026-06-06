"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useGroups } from '@/hooks/use-groups';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Send, Loader2 } from 'lucide-react';

interface CouponTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateBody: string;
  mediaUrl: string;
}

export function CouponTestModal({ isOpen, onClose, templateBody, mediaUrl }: CouponTestModalProps) {
  const { user } = useAuth();
  const { data: groups, isLoading: loadingGroups } = useGroups(user?.id);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [isSending, setIsSending] = useState(false);

  const handleSendTest = async () => {
    if (!selectedGroupId) {
      toast.error('Selecione um grupo para enviar o teste.');
      return;
    }

    try {
      setIsSending(true);
      const res = await fetch('/api/shopee/automation-coupons/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: selectedGroupId,
          template_config: {
            body: templateBody,
            media_url: mediaUrl
          }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao enviar o teste');
      }

      toast.success('Mensagem de teste enviada para o grupo selecionado!');
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-deep-void border border-white/10 text-white shadow-skeuo-elevated">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Enviar Teste Real</DialogTitle>
          <DialogDescription className="text-white/60">
            Selecione um grupo de teste (onde você está conectado) para ver como o layout chegará no celular dos membros.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">Grupo de Destino</label>
            <select
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-kinetic-orange/50 transition-colors"
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              disabled={loadingGroups || isSending}
            >
              <option value="" className="text-black">-- Selecione um grupo --</option>
              {groups?.map((g) => (
                <option key={g.id} value={g.id} className="text-black">
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="bg-kinetic-orange/10 p-3 rounded-lg border border-kinetic-orange/20 text-xs text-kinetic-orange/90 leading-relaxed">
            <p><strong>Atenção:</strong> Esta ação pegará um cupom real capturado recentemente e usará suas configurações de mídia e texto para enviar uma mensagem real no grupo selecionado.</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={isSending}>Cancelar</Button>
          <Button 
            onClick={handleSendTest}
            disabled={!selectedGroupId || isSending}
            className="bg-kinetic-orange hover:bg-kinetic-orange/80 shadow-glow-orange font-bold uppercase tracking-widest text-[10px] gap-2"
          >
            {isSending ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
            Disparar Agora
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
