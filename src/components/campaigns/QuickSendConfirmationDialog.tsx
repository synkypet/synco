import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, AlertTriangle, Layers, Send, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickSendConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  productsCount: number;
  groupsCount: number;
  channelNames: string[];
  destinationsNames: string[];
  // Coupon Specific (Fase 2E.1B)
  isCouponMode?: boolean;
  couponPreview?: string;
  isLinkAvailable?: boolean;
  affiliateLink?: string;
}

export function QuickSendConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  productsCount,
  groupsCount,
  channelNames,
  destinationsNames,
  isCouponMode = false,
  couponPreview,
  isLinkAvailable = true,
  affiliateLink
}: QuickSendConfirmationDialogProps) {
  const totalMessages = productsCount * groupsCount;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-deep-void border-none shadow-skeuo-elevated max-w-md rounded-3xl ring-1 ring-white/5">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shadow-skeuo-flat ring-1",
              isCouponMode ? "bg-indigo-500/10 ring-indigo-500/20" : "bg-kinetic-orange/10 ring-kinetic-orange/20"
            )}>
              <UserCheck className={cn("w-5 h-5", isCouponMode ? "text-indigo-400" : "text-kinetic-orange")} />
            </div>
            <div>
              <AlertDialogTitle className="text-lg font-black uppercase tracking-widest font-headline italic">
                {isCouponMode ? 'Confirmar Envio de Cupom' : 'Confirmar Disparo'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[10px] uppercase font-bold text-white/30 tracking-widest">
                {isCouponMode ? 'Revisão de envio manual de cupom' : 'Revisão final antes da transmissão'}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="space-y-6 py-4">
          {/* Preview de Cupom (Fase 2E.1B) */}
          {isCouponMode && couponPreview && (
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40 px-1">Prévia da Mensagem</span>
              <div className="bg-black/40 rounded-2xl p-4 border border-white/5 shadow-skeuo-pressed">
                <ScrollArea className="h-32 w-full">
                  <pre className="text-[11px] font-mono whitespace-pre-wrap text-white/70 leading-relaxed">
                    {couponPreview}
                  </pre>
                </ScrollArea>
              </div>
              {!isLinkAvailable && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 rounded-xl border border-amber-500/20 mt-2">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-amber-500/80">
                    Sem link afiliado. O envio será apenas do código.
                  </span>
                </div>
              )}
              {isLinkAvailable && affiliateLink && (
                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 mt-2">
                  <Layers className="w-3 h-3 text-indigo-400" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-indigo-400/80 truncate">
                    Link: {affiliateLink}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Resumo de Carga */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 shadow-skeuo-pressed">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/20 block mb-1">Carga Total</span>
              <div className="flex items-baseline gap-1">
                <span className={cn("text-2xl font-black italic", isCouponMode ? "text-indigo-400" : "text-kinetic-orange")}>{totalMessages}</span>
                <span className="text-[9px] font-bold text-white/40 uppercase">Envios</span>
              </div>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 shadow-skeuo-pressed">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/20 block mb-1">Canais</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-white/80 italic">{channelNames.length}</span>
                <span className="text-[9px] font-bold text-white/40 uppercase">Ativos</span>
              </div>
            </div>
          </div>

          {/* Lista de Grupos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Destinos de Transmissão</span>
              <Badge variant="outline" className="h-5 text-[8px] border-none bg-white/5 text-white/40">{groupsCount} Grupos</Badge>
            </div>
            <ScrollArea className="h-24 w-full rounded-2xl bg-black/20 p-3 border border-white/5 shadow-skeuo-pressed">
              <div className="space-y-1.5">
                {destinationsNames.map((name, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-kinetic-orange/40" />
                    <span className="text-[10px] font-bold text-white/60 truncate uppercase tracking-tight">{name}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Alerta de Segurança */}
          <div className={cn(
            "flex flex-col gap-3 p-4 rounded-2xl border",
            isCouponMode ? "bg-indigo-500/5 border-indigo-500/10" : "bg-amber-500/5 border-amber-500/10"
          )}>
            <div className="flex items-start gap-3">
              <AlertTriangle className={cn("w-4 h-4 shrink-0 mt-0.5", isCouponMode ? "text-indigo-400" : "text-amber-500")} />
              <p className={cn("text-[9px] font-bold leading-relaxed uppercase", isCouponMode ? "text-indigo-400/60" : "text-amber-500/60")}>
                {isCouponMode 
                  ? "Este envio é manual. O envio automático de cupons continua desativado. Os cupons podem expirar ou mudar conforme disponibilidade da Shopee."
                  : "Ao confirmar, o SYNCO iniciará o processamento imediato. Certifique-se de que o conteúdo e os alvos estão corretos."
                }
              </p>
            </div>
          </div>
        </div>

        <AlertDialogFooter className="gap-3 sm:gap-0">
          <AlertDialogCancel className="bg-white/5 border-none text-[10px] font-black uppercase tracking-widest h-12 rounded-xl hover:bg-white/10 transition-all">
            Revisar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className={cn(
              "shadow-glow-orange-intense border-none text-[10px] font-black uppercase tracking-widest h-12 rounded-xl transition-all text-black",
              isCouponMode ? "bg-indigo-500 hover:bg-indigo-600" : "bg-kinetic-orange hover:bg-kinetic-orange/90"
            )}
          >
            {isCouponMode ? 'Confirmar Envio Manual' : 'Confirmar e Enviar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
