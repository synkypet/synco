'use client';

import React, { useState, useEffect } from 'react';
import { KineticButton } from '@/components/ui/KineticButton';
import { Label } from '@/components/ui/label';
import { Loader2, Copy, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMLSessionStatus } from '@/hooks/useMLSessionStatus';

export function MercadoLivreExtensionPairing() {
  const [localStatus, setLocalStatus] = useState<
    'idle' | 'loading' | 'code_ready' | 'error' | 'rate_limited'
  >('idle');
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  const shouldPoll = localStatus === 'code_ready';

  const {
    status: integrationStatus,
    isLoading: statusLoading,
    lastSyncedAt,
    expiresAt: sessionExpiresAt,
    refetch
  } = useMLSessionStatus({
    pollingIntervalMs: shouldPoll ? 4000 : 0,
    enabled: true
  });

  // Call refetch immediately when transitioning to code_ready
  useEffect(() => {
    if (localStatus === 'code_ready') {
      refetch();
    }
  }, [localStatus, refetch]);

  useEffect(() => {
    if (localStatus !== 'code_ready' || !expiresAt) return;

    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      );
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        setLocalStatus('idle');
        setCode(null);
        setExpiresAt(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [localStatus, expiresAt]);

  async function generateCode() {
    setLocalStatus('loading');
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
        setLocalStatus('code_ready');
      } else if (response.status === 429) {
        setLocalStatus('rate_limited');
      } else {
        setLocalStatus('error');
      }
    } catch {
      setLocalStatus('error');
    }
  }

  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // falha silenciosa
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('pt-BR');
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

      {/* Permanent Status Block */}
      <div className="bg-deep-void/50 border border-white/5 rounded-xl p-3 space-y-2">
        {statusLoading && integrationStatus === null ? (
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Verificando status...</p>
        ) : integrationStatus === 'not_paired' ? (
          <span className="inline-block px-2 py-1 rounded bg-white/5 text-white/40 text-[9px] font-black uppercase tracking-widest">
            Não pareada
          </span>
        ) : integrationStatus === 'paired_no_session' ? (
          <span className="inline-block px-2 py-1 rounded bg-yellow-500/10 text-yellow-400 text-[9px] font-black uppercase tracking-widest">
            Pareada, aguardando sessão
          </span>
        ) : integrationStatus === 'session_ready' ? (
          <div className="space-y-2">
            <span className="inline-block px-2 py-1 rounded bg-green-500/10 text-green-400 text-[9px] font-black uppercase tracking-widest">
              ✅ Mercado Livre conectado
            </span>
            <div className="space-y-1">
              <p className="text-[9px] text-white/60 tracking-widest">Última sync: {formatDate(lastSyncedAt)}</p>
              <p className="text-[9px] text-white/60 tracking-widest">Válida até: {formatDate(sessionExpiresAt)}</p>
            </div>
            <button
              onClick={() => refetch()}
              className="text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-white/60 underline decoration-white/20 underline-offset-2"
            >
              Atualizar status
            </button>
          </div>
        ) : integrationStatus === 'session_expired' ? (
          <div className="space-y-2">
            <span className="inline-block px-2 py-1 rounded bg-red-500/10 text-red-400 text-[9px] font-black uppercase tracking-widest">
              ⚠️ Sessão expirada
            </span>
            <p className="text-[9px] text-white/60 tracking-widest">
              Sincronize novamente pela extensão.
            </p>
          </div>
        ) : integrationStatus === 'session_revoked' ? (
          <div className="space-y-2">
            <span className="inline-block px-2 py-1 rounded bg-white/5 text-white/40 text-[9px] font-black uppercase tracking-widest">
              Sessão revogada
            </span>
            <p className="text-[9px] text-white/60 tracking-widest">
              Reconecte a extensão para reativar.
            </p>
          </div>
        ) : null}
      </div>

      {localStatus === 'idle' && (
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

      {localStatus === 'loading' && (
        <KineticButton
          disabled
          className="h-10 w-full font-black uppercase tracking-widest text-[10px]"
        >
          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Gerando...
        </KineticButton>
      )}

      {localStatus === 'code_ready' && (
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

          <div className="bg-deep-void/30 p-3 rounded-lg border border-white/5 text-center">
            {(!integrationStatus || integrationStatus === 'not_paired') && (
              <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest animate-pulse">
                Aguardando conexão da extensão...
              </p>
            )}
            {integrationStatus === 'paired_no_session' && (
              <p className="text-[10px] text-kinetic-orange font-bold uppercase tracking-widest">
                Extensão pareada. Clique em Sincronizar agora na extensão.
              </p>
            )}
            {integrationStatus === 'session_ready' && (
              <div className="space-y-1">
                <p className="text-[10px] text-green-400 font-bold uppercase tracking-widest">
                  ✅ Mercado Livre conectado com sucesso!
                </p>
                <p className="text-[9px] text-white/40 tracking-widest">
                  Sincronizado: {formatDate(lastSyncedAt)}
                </p>
              </div>
            )}
            {integrationStatus === 'session_expired' && (
              <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest">
                Sessão expirada. Sincronize novamente.
              </p>
            )}
            {integrationStatus === 'session_revoked' && (
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                Sessão revogada. Gere novo código.
              </p>
            )}
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

      {localStatus === 'rate_limited' && (
        <div className="space-y-3">
          <p className="text-[9px] text-red-400 tracking-tighter leading-tight">
            Limite de códigos atingido. Aguarde alguns minutos e tente novamente.
          </p>
          <KineticButton
            onClick={() => setLocalStatus('idle')}
            className="h-10 w-full font-black uppercase tracking-widest text-[10px] bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
          >
            Tentar novamente
          </KineticButton>
        </div>
      )}

      {localStatus === 'error' && (
        <div className="space-y-3">
          <p className="text-[9px] text-red-400 tracking-tighter leading-tight">
            Não foi possível gerar o código. Tente novamente.
          </p>
          <KineticButton
            onClick={() => setLocalStatus('idle')}
            className="h-10 w-full font-black uppercase tracking-widest text-[10px] bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
          >
            Tentar novamente
          </KineticButton>
        </div>
      )}
    </div>
  );
}
