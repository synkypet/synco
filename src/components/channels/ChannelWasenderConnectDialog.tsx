import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, RefreshCw, CheckCircle2, XCircle, Phone } from 'lucide-react';
import { Channel } from '@/types/group';
import QRCode from 'react-qr-code';

interface ChannelWasenderConnectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel | null;
  onConnected: () => void;
}

export function ChannelWasenderConnectDialog({ isOpen, onClose, channel, onConnected }: ChannelWasenderConnectDialogProps) {
  const [step, setStep] = useState<'verifying' | 'legacy_detected' | 'phone_input' | 'init' | 'qrcode' | 'connected' | 'error'>('verifying');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [qrString, setQrString] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Ao abrir, resetar tudo e buscar status fresco
  useEffect(() => {
    if (isOpen && channel) {
      const initModal = async () => {
        setStep('verifying');
        setQrString(null);
        setErrorMsg('');
        
        try {
          console.log(`[MODAL-CONNECT] Verificando status fresco para canal ${channel.id}...`);
          const res = await fetch(`/api/wasender/channels/${channel.id}`);
          const data = await res.json();
          
          if (!res.ok) {
            if (data.reason === 'LEGACY_CHANNEL_RECONFIG_NEEDED') {
                setStep('legacy_detected');
                return;
            }
            throw new Error(data.error || 'Falha ao validar status atual');
          }

          const currentStatus = data.status || 'unknown';
          
          if (currentStatus === 'connected') {
            setStep('connected');
          } else {
            const savedPhone = channel.config?.phoneNumber || channel.config?.phone_number;
            if (savedPhone) {
              console.log(`[MODAL-CONNECT] Número salvo encontrado (${savedPhone}). Iniciando auto-conexão...`);
              setPhoneNumber(savedPhone);
              handleInitiateConnection(savedPhone);
            } else {
              setStep('phone_input');
            }
          }
        } catch (err: any) {
          setStep('error');
          setErrorMsg(err.message);
        }
      };

      initModal();
    }
  }, [isOpen, channel?.id]);

  // Polling de Status (Corrigido para usar a nova rota de canal)
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isOpen && step === 'qrcode' && channel?.id) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/wasender/channels/${channel.id}`);
          const data = await res.json();

          if (data.status === 'connected') {
            setStep('connected');
            onConnected();
          } else if (data.status === 'logged_out' || data.status === 'expired') {
            setStep('error');
            setErrorMsg('A sessão foi encerrada ou expirou.');
          }
        } catch (err) {
            console.error("Polling error", err);
        }
      }, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    }
  }, [isOpen, step, channel?.id, onConnected]);

  const handlePhoneSubmit = () => {
    if (!phoneNumber.trim()) return;
    handleInitiateConnection(phoneNumber.trim());
  };

  const handleInitiateConnection = async (phone: string) => {
    try {
      setStep('init');
      setErrorMsg('');
      setQrString(null);

      // Trigger server-side Create + Connect com phone_number
      const res = await fetch('/api/wasender/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: channel?.id, phone_number: phone })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Falha ao iniciar sessão');

      // 1. Sucesso Imediato: Se já conectou agora
      if (data.status === 'connected') {
        setStep('connected');
        onConnected();
        return;
      }

      // 2. Estado Esperado: Precisa de Scan
      if (data.status === 'need_scan' || data.status === 'qrcode_pending' || data.status === 'AWAITING_SCAN') {
        // Se o QR CODE já veio no payload do connect (performance)
        if (data.qrcode) {
           console.log("[MODAL-CONNECT] QR Code recebido diretamente no connect.");
           setQrString(data.qrcode);
           setStep('qrcode');
           return;
        }

        // 3. Fallback: Se não veio QR, buscar no endpoint dedicado
        console.log("[MODAL-CONNECT] Buscando QR Code no endpoint de fallback...");
        const qrRes = await fetch(`/api/wasender/session/qrcode?channel_id=${channel?.id}`);
        const qrData = await qrRes.json();
        
        if (!qrRes.ok) throw new Error(qrData.error || 'Falha ao buscar QR Code');
        if (qrData.qrcode) {
           setQrString(qrData.qrcode);
           setStep('qrcode');
        } else {
           throw new Error('QR Code ainda não disponível. Tente novamente em alguns segundos.');
        }
      } else {
        setStep('error');
        setErrorMsg(`Status operacional inesperado: ${data.status}`);
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
          {step === 'verifying' && (
            <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
               <Loader2 className="w-12 h-12 animate-spin text-kinetic-orange opacity-40" />
               <p className="text-xs font-bold tracking-widest uppercase text-white/30">Validando Sincronia...</p>
            </div>
          )}

          {step === 'legacy_detected' && (
            <div className="flex flex-col items-center gap-5 w-full px-4 animate-in fade-in zoom-in duration-300">
               <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center">
                 <RefreshCw className="w-7 h-7 text-amber-500" />
               </div>
               <div className="text-center space-y-2">
                 <p className="text-sm font-semibold text-white/80">Canal Legado Detectado</p>
                 <p className="text-xs text-white/40 px-4">
                    Este canal foi criado em uma versão antiga e não possui um vínculo operacional válido com a Wasender.
                 </p>
               </div>
               <Button 
                 onClick={() => setStep('phone_input')}
                 className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-glow-orange"
               >
                 Recriar sessão
               </Button>
            </div>
          )}

          {step === 'phone_input' && (
            <div className="flex flex-col items-center gap-5 w-full px-4 animate-in fade-in zoom-in duration-300">
               <div className="w-14 h-14 rounded-full bg-kinetic-orange/10 flex items-center justify-center">
                 <Phone className="w-7 h-7 text-kinetic-orange" />
               </div>
               <div className="text-center space-y-1">
                 <p className="text-sm font-semibold text-white/80">Informe seu número do WhatsApp</p>
                 <p className="text-xs text-white/40">Com código do país. Ex: +5511999999999</p>
               </div>
               <Input
                 type="tel"
                 placeholder="+5511999999999"
                 value={phoneNumber}
                 onChange={(e) => setPhoneNumber(e.target.value)}
                 className="bg-deep-void border-white/10 text-white text-center text-lg tracking-wider placeholder:text-white/20"
                 onKeyDown={(e) => e.key === 'Enter' && handlePhoneSubmit()}
               />
               <Button 
                 onClick={handlePhoneSubmit}
                 disabled={!phoneNumber.trim()}
                 className="w-full bg-kinetic-orange hover:bg-kinetic-orange/90 text-white font-bold shadow-glow-orange"
               >
                 Conectar
               </Button>
            </div>
          )}

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
                <Button variant="outline" className="mt-4 border-red-500/20 hover:bg-red-500/10 text-red-500" onClick={() => setStep('phone_input')}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Tentar Novamente
                </Button>
             </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
