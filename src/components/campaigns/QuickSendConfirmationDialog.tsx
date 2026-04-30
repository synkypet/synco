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
}

export function QuickSendConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  productsCount,
  groupsCount,
  channelNames,
  destinationsNames
}: QuickSendConfirmationDialogProps) {
  const totalMessages = productsCount * groupsCount;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-deep-void border-none shadow-skeuo-elevated max-w-md rounded-3xl ring-1 ring-white/5">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-kinetic-orange/10 flex items-center justify-center shadow-skeuo-flat ring-1 ring-kinetic-orange/20">
              <UserCheck className="w-5 h-5 text-kinetic-orange" />
            </div>
            <div>
              <AlertDialogTitle className="text-lg font-black uppercase tracking-widest font-headline italic">
                Confirmar Disparo
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[10px] uppercase font-bold text-white/30 tracking-widest">
                Revisão final antes da transmissão
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="space-y-6 py-4">
          {/* Resumo de Carga */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5 shadow-skeuo-pressed">
              <span className="text-[9px] font-black uppercase tracking-widest text-white/20 block mb-1">Carga Total</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-kinetic-orange italic">{totalMessages}</span>
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
            <ScrollArea className="h-32 w-full rounded-2xl bg-black/20 p-3 border border-white/5 shadow-skeuo-pressed">
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
          <div className="flex items-start gap-3 p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[9px] font-bold leading-relaxed text-amber-500/60 uppercase">
              Ao confirmar, o SYNCO iniciará o processamento imediato. Certifique-se de que o conteúdo e os alvos estão corretos.
            </p>
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
            className="bg-kinetic-orange hover:bg-kinetic-orange/90 text-black shadow-glow-orange-intense border-none text-[10px] font-black uppercase tracking-widest h-12 rounded-xl transition-all"
          >
            Confirmar e Enviar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
