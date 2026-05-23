'use client';

import React, { useState, useEffect } from 'react';
import { KineticButton } from '@/components/ui/KineticButton';
import { Label } from '@/components/ui/label';
import { Loader2, Copy, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MercadoLivreExtensionPairing() {
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'code_ready' | 'error' | 'rate_limited'
  >('idle');
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (status !== 'code_ready' || !expiresAt) return;

    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      );
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        setStatus('idle');
        setCode(null);
        setExpiresAt(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status, expiresAt]);

  async function generateCode() {
    setStatus('loading');
    try {
      const response = await fetch('/api/ml/pairing/generate', {
        method: 'POST'
      });
      if (response.ok) {
        const data = await response.json();
        const remaining = Math.max(
          0,
          Math.floor((new Date(data.expires_at).getTime() - Date.now()) / 1000)
        );
        setCode(data.code);
        setExpiresAt(data.expires_at);
        setSecondsLeft(remaining);
        setStatus('code_ready');
      } else if (response.status === 429) {
        setStatus('rate_limited');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // falha silenciosa — usuário pode copiar manualmente
    }
  }

  return (
    <div className="pt-4 mt-6 border-t border-white/5 space-y-4">
      <div className="space-y-1">
        <Label className="text-[10px] font-black uppercase tracking-widest text-white/60">
          Extensão Chrome
        </Label>
        <p className="text-[9px] text-white/40 tracking-tighter leading-tight">
          Pareie a extensão Synco com sua conta para gerar links meli.la automaticamente.
        </p>
      </div>

      {status === 'idle' && (
        <div className="space-y-3">
          <p className="text-[9px] font-bold text-kinetic-orange uppercase tracking-tighter">
            Download da extensão: em breve no painel Synco.
          </p>
          <KineticButton
            onClick={generateCode}
            className="h-10 w-full font-black uppercase tracking-widest text-[10px]"
          >
            Gerar código de pareamento
          </KineticButton>
        </div>
      )}

      {status === 'loading' && (
        <KineticButton
          disabled
          className="h-10 w-full font-black uppercase tracking-widest text-[10px]"
        >
          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Gerando...
        </KineticButton>
      )}

      {status === 'code_ready' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-500">
          <div className="space-y-2 text-center">
            <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">
              Cole este código na extensão Chrome Synco:
            </Label>
            <div className="bg-deep-void border-none shadow-skeuo-pressed text-2xl font-mono h-14 flex items-center justify-center rounded-xl tracking-[0.5em] text-kinetic-orange font-bold">
              {code}
            </div>
            <p className={cn(
              "text-[9px] font-black uppercase tracking-widest",
              secondsLeft <= 30 ? "text-red-400 animate-pulse" : "text-white/40"
            )}>
              Expira em {secondsLeft}s
            </p>
          </div>

          <div className="flex items-center gap-3">
            <KineticButton
              onClick={handleCopy}
              disabled={copied}
              className="h-10 flex-1 font-black uppercase tracking-widest text-[10px]"
            >
              {copied ? 'Copiado!' : <><Copy className="w-3.5 h-3.5 mr-2" /> Copiar código</>}
            </KineticButton>
            
            <button
              onClick={generateCode}
              className="flex items-center justify-center gap-2 h-10 w-10 rounded-lg border text-[9px] font-black uppercase tracking-widest bg-deep-void/50 border-white/5 text-white/40 hover:text-white/60 hover:border-white/10 transition-all shrink-0"
              title="Gerar novo código"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="pt-2 border-t border-white/5 space-y-1">
            <p className="text-[9px] text-white/20 tracking-tighter leading-tight">1. Abra a extensão Synco no Chrome</p>
            <p className="text-[9px] text-white/20 tracking-tighter leading-tight">2. Cole o código no campo de pareamento</p>
            <p className="text-[9px] text-white/20 tracking-tighter leading-tight">3. Marque a autorização e clique em Conectar</p>
          </div>
        </div>
      )}

      {status === 'rate_limited' && (
        <div className="space-y-3">
          <p className="text-[9px] text-red-400 tracking-tighter leading-tight">
            Limite de códigos atingido. Aguarde alguns minutos e tente novamente.
          </p>
          <KineticButton
            onClick={() => setStatus('idle')}
            className="h-10 w-full font-black uppercase tracking-widest text-[10px] bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
          >
            Tentar novamente
          </KineticButton>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-3">
          <p className="text-[9px] text-red-400 tracking-tighter leading-tight">
            Não foi possível gerar o código. Tente novamente.
          </p>
          <KineticButton
            onClick={() => setStatus('idle')}
            className="h-10 w-full font-black uppercase tracking-widest text-[10px] bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
          >
            Tentar novamente
          </KineticButton>
        </div>
      )}
    </div>
  );
}
