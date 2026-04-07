import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { Channel } from '@/types/group';
import QRCode from 'react-qr-code';

interface ChannelWasenderConnectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel | null;
  onConnected: () => void;
}

export function ChannelWasenderConnectDialog({ isOpen, onClose, channel, onConnected }: ChannelWasenderConnectDialogProps) {
  const [step, setStep] = useState<'init' | 'qrcode' | 'connected' | 'error'>('init');
  const [qrString, setQrString] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Passo 1: Solicitar conexão ao abrir se não estiver em andamento
  useEffect(() => {
    if (isOpen && channel) {
      if (channel.config?.status === 'connected') {
         setStep('connected');
         return;
      }
      handleInitiateConnection();
    }
  }, [isOpen, channel]);

  // Passo 2: Polling de Status
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isOpen && step === 'qrcode' && channel?.id) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/wasender/session?channel_id=${channel.id}`);
          const data = await res.json();

          if (data.status === 'connected') {
            setStep('connected');
            onConnected();
          } else if (data.status === 'qrcode_pending') {
             // Continue polling
          } else if (data.status === 'disconnected' || data.status === 'session_lost') {
            setStep('error');
            setErrorMsg('A sessão foi desconectada.');
          }
        } catch (err) {
            console.error("Polling error", err);
        }
      }, 5000); // Poll a cada 5 segundos
    }

    return () => {
      if (interval) clearInterval(interval);
    }
  }, [isOpen, step, channel?.id, onConnected]);

  const handleInitiateConnection = async () => {
    try {
      setStep('init');
      setErrorMsg('');
      setQrString(null);

      // Trigger server-side Create + Connect
      const res = await fetch('/api/wasender/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channel?.id })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Falha ao iniciar sessão');

      // Se entrou em modo pendente, busca a QR String
      if (data.status === 'qrcode_pending' || data.status === 'AWAITING_SCAN') {
        const qrRes = await fetch(`/api/wasender/session/qrcode?channel_id=${channel?.id}`);
        const qrData = await qrRes.json();
        
        if (!qrRes.ok) throw new Error(qrData.error || 'Falha ao buscar QR Code');
        if (qrData.qrcode) {
           setQrString(qrData.qrcode);
           setStep('qrcode');
        } else {
           throw new Error('Nenhum QR retornado');
        }
      } else if (data.status === 'connected') {
        setStep('connected');
        onConnected();
      } else {
        setStep('error');
        setErrorMsg(`Status inesperado: ${data.status}`);
      }

    } catch (error: any) {
      setStep('error');
      setErrorMsg(error.message);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-anthracite-surface border-none shadow-skeuo-elevated text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-white/90">Conectar WhatsApp</DialogTitle>
          <DialogDescription className="text-white/50">
            Escaneie o QR Code para conectar a sessão da Wasender e autorizar envios pelo seu número.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center min-h-[300px] py-6">
          {step === 'init' && (
            <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
               <Loader2 className="w-12 h-12 animate-spin text-kinetic-orange" />
               <p className="text-sm font-medium text-white/70">Inicializando conexão segura...</p>
            </div>
          )}

          {step === 'qrcode' && qrString && (
            <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
               <div className="p-4 bg-white rounded-2xl shadow-skeuo-flat border border-white/10">
                 <QRCode value={qrString} size={220} className="rounded-lg mix-blend-multiply" />
               </div>
               <div className="text-center space-y-2">
                 <p className="text-xs font-bold text-kinetic-orange tracking-widest uppercase flex items-center gap-2 justify-center">
                   <Loader2 className="w-3 h-3 animate-spin"/> Aguardando Leitura
                 </p>
                 <p className="text-sm text-white/50 px-6 text-balance">
                    Abra o WhatsApp no seu celular, vá em Aparelhos Conectados e escaneie este código.
                 </p>
               </div>
            </div>
          )}

          {step === 'connected' && (
             <div className="flex flex-col items-center gap-4 text-emerald-500 animate-in fade-in slide-in-from-bottom-2">
                <CheckCircle2 className="w-16 h-16" />
                <p className="text-lg font-bold tracking-tight">WhatsApp Conectado!</p>
                <p className="text-sm text-emerald-500/60 text-center px-4">
                  A sessão de envios foi sincronizada com sucesso e está pronta para uso.
                </p>
             </div>
          )}

          {step === 'error' && (
             <div className="flex flex-col items-center gap-4 text-red-500 text-center animate-in fade-in">
                <XCircle className="w-12 h-12" />
                <p className="font-bold">Ocorreu um erro</p>
                <p className="text-sm text-red-500/70">{errorMsg}</p>
                <Button variant="outline" className="mt-4 border-red-500/20 hover:bg-red-500/10 text-red-500" onClick={handleInitiateConnection}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Tentar Novamente
                </Button>
             </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
