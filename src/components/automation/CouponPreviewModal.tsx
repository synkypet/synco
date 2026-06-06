"use client";

import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { renderSmartTemplate, DEFAULT_TEMPLATES } from '@/lib/templates/universal-template-engine';

interface CouponPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateBody: string;
  mediaUrl: string;
}

export function CouponPreviewModal({ isOpen, onClose, templateBody, mediaUrl }: CouponPreviewModalProps) {
  const renderedMessage = useMemo(() => {
    const mockContext = {
      product_name: '50% OFF em Produtos Selecionados',
      affiliate_link: 'https://shp.ee/mocklink',
      coupon_code: 'SHOPEE50',
      coupon_code_line: '🎟️ *Código:* SHOPEE50',
      coupon_discount_line: '💸 50% OFF',
      coupon_link: 'https://shp.ee/mocklink',
      coupon_link_line: '🔗 *Resgate aqui:*\nhttps://shp.ee/mocklink',
      smart_price_block: '',
      original_price_line: '',
      current_price_line: '',
      coupon_block: '',
      disclaimer: '',
      marketplace: 'Shopee',
      offer_type: 'coupon_offer' as any
    };

    const tpl = templateBody || DEFAULT_TEMPLATES.shopee_coupon;
    return renderSmartTemplate(tpl, mockContext as any);
  }, [templateBody]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-deep-void border border-white/10 text-white shadow-skeuo-elevated">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            👁️ Preview do Template
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 p-4 bg-[#ece5dd] rounded-xl relative max-h-[60vh] overflow-y-auto">
          {/* Fundo simulando WhatsApp */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("https://web.whatsapp.com/img/bg-chat-tile-dark_a4be512e7195b6b733d9110b408f075d.png")' }}></div>
          
          <div className="relative bg-white text-black p-2 rounded-lg rounded-tl-none max-w-[85%] shadow-sm">
            {mediaUrl && (
              <div className="mb-2 rounded-md overflow-hidden bg-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl} alt="Preview Mídia" className="w-full h-auto object-cover max-h-[250px]" />
              </div>
            )}
            
            <div className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed break-words">
              {renderedMessage}
            </div>
            
            <div className="text-[10px] text-gray-400 text-right mt-1">
              {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
