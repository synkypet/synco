/* eslint-disable react/no-unescaped-entities */
'use client';

import React, { useState } from 'react';
import { Channel } from '@/types/group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Bot, CheckCircle2, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface ChannelTelegramConnectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel | null;
  onConnected: () => void;
}

export function ChannelTelegramConnectDialog({
  isOpen,
  onClose,
  channel,
  onConnected
}: ChannelTelegramConnectDialogProps) {
  const [token, setToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnectedState, setIsConnectedState] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setToken('');
      setIsConnecting(false);
      setIsConnectedState(false);
    }
  }, [isOpen]);

  const handleConnect = async () => {
    if (!token.trim()) {
      toast.error('Informe o Bot Token gerado no @BotFather do Telegram');
      return;
    }

    if (!channel) return;

    setIsConnecting(true);

    try {
      const res = await fetch('/api/telegram/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: channel.id, botToken: token.trim() })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setIsConnectedState(true);
      toast.success(`Bot @${data.bot.username} conectado com sucesso!`);
      setTimeout(() => {
        onConnected();
        onClose();
      }, 1500);

    } catch (e: any) {
      toast.error(e.message || 'Falha ao conectar via Token');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="text-blue-500" />
            Conectar Bot do Telegram
          </DialogTitle>
          <DialogDescription>
            Insira o Token do Bot criado usando o BotFather.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!isConnectedState ? (
            <>
              <div className="bg-blue-500/10 p-3 rounded-lg border border-blue-500/20 text-sm text-blue-700 dark:text-blue-400">
                <p className="font-semibold mb-1">Como criar um Bot:</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Abra o Telegram e pesquise por <strong>@BotFather</strong></li>
                  <li>Envie a mensagem <span className="font-mono bg-blue-500/20 px-1 rounded">/newbot</span></li>
                  <li>Siga os passos escolhendo um nome e username</li>
                  <li>Copie o "HTTP API Token" gerado e cole abaixo.</li>
                </ol>
              </div>

              <div className="space-y-2">
                <Label htmlFor="token" className="font-bold">Bot Token (HTTP API)</Label>
                <Input
                  id="token"
                  placeholder="Ex: 1234567890:AAH_XYZ...abc123"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <Button 
                onClick={handleConnect} 
                disabled={isConnecting || !token.trim()} 
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold tracking-wide"
              >
                {isConnecting ? 'Validando Token...' : 'Conectar Bot'}
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center animate-bounce">
                <CheckCircle2 size={32} className="text-emerald-500" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-bold text-emerald-600">Bot Autenticado!</h3>
                <p className="text-sm text-muted-foreground mt-1">Seu bot está pronto para enviar mensagens.</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
