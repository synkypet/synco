'use client';

import React, { useState, useEffect } from 'react';
import { KineticButton } from '@/components/ui/KineticButton';
import { Label } from '@/components/ui/label';
import { Loader2, Copy, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MLSessionStatus } from '@/hooks/useMLSessionStatus';

interface MercadoLivreExtensionPairingProps {
  integrationStatus: MLSessionStatus | null;
  statusLoading: boolean;
  lastSyncedAt: string | null;
  sessionExpiresAt: string | null;
  refetch: () => void;
  setShouldPoll: (poll: boolean) => void;
}

export function MercadoLivreExtensionPairing({
  integrationStatus,
  statusLoading,
  lastSyncedAt,
  sessionExpiresAt,
  refetch,
  setShouldPoll
}: MercadoLivreExtensionPairingProps) {
  const [localStatus, setLocalStatus] = useState<
    'idle' | 'loading' | 'code_ready' | 'error' | 'rate_limited'
  >('idle');
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    setShouldPoll(localStatus === 'code_ready');
  }, [localStatus, setShouldPoll]);

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

  useEffect(() => {
    if (integrationStatus === 'session_ready' && localStatus === 'code_ready') {
      const timer = setTimeout(() => {
        setCode(null);
        setExpiresAt(null);
        setLocalStatus('idle');
      }, 1500); // usuário vê confirmação antes do dismiss
      return () => clearTimeout(timer);
    }
  }, [integrationStatus, localStatus]);

  async function generateCode() {
    if (integrationStatus === 'session_ready' || integrationStatus === 'paired_no_session') {
      setShowDisconnectConfirm(true);
      return;
    }
    await executeGenerateCode();
  }

  async function executeGenerateCode() {
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

  async function confirmDisconnectAndGenerate() {
    setShowDisconnectConfirm(false);
    setLocalStatus('loading');
    try {
      await fetch('/api/ml/session/disconnect', { method: 'POST' });
      await refetch();
      await executeGenerateCode();
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
      // falha silenciosa — usuário pode copiar manualmente
    }
  }

  return (
    <div className="pt-4 border-t border-white/5 space-y-4">
      <div className="space-y-1 mb-4">
        <Label className="text-[10px] font-black uppercase tracking-widest text-white/60">
          Extensão Chrome
        </Label>
        <p className="text-[9px] text-white/40 tracking-tighter leading-tight">
          {integrationStatus === 'session_ready' 
            ? 'Extensão conectada. O Synco já pode gerar links meli.la automaticamente.' 
            : 'Para gerar links curtos meli.la automaticamente, instale a extensão Chrome do Synco e conecte sua conta Mercado Livre.'}
        </p>
      </div>

      <div className="flex flex-col gap-1.5 mb-4 bg-deep-void/50 p-3 rounded-xl border border-white/5 shadow-skeuo-pressed">
        {statusLoading && integrationStatus === null ? (
          <span className="text-[9px] text-white/40 uppercase tracking-widest font-black">Verificando status...</span>
        ) : integrationStatus === 'not_paired' ? (
          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Não pareada</span>
        ) : integrationStatus === 'paired_no_session' ? (
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Pareada, aguardando sessão</span>
        ) : integrationStatus === 'session_ready' ? (
          <>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">✅ Mercado Livre conectado</span>
            {lastSyncedAt && <span className="text-[9px] text-white/40 uppercase tracking-widest">Última sync: {new Date(lastSyncedAt).toLocaleString('pt-BR')}</span>}
            {sessionExpiresAt && <span className="text-[9px] text-white/40 uppercase tracking-widest">Válida até: {new Date(sessionExpiresAt).toLocaleString('pt-BR')}</span>}
            <button onClick={refetch} className="mt-1 text-[9px] text-kinetic-orange font-bold uppercase tracking-widest hover:underline text-left">Atualizar status</button>
          </>
        ) : integrationStatus === 'session_expired' ? (
          <>
            <span className="text-[10px] font-black uppercase tracking-widest text-red-400">⚠️ Sessão expirada</span>
            <span className="text-[9px] text-white/40 uppercase tracking-widest">Sincronize novamente pela extensão.</span>
          </>
        ) : integrationStatus === 'session_revoked' ? (
          <>
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Sessão revogada</span>
            <span className="text-[9px] text-white/40 uppercase tracking-widest">Reconecte a extensão para reativar.</span>
          </>
        ) : null}
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex flex-col gap-2">
          <a 
            href="/downloads/synco-ml-extension.zip" 
            download 
            className="flex items-center justify-center h-10 w-full rounded-lg bg-deep-void border border-white/10 text-white hover:bg-white/5 transition-colors text-[10px] font-black uppercase tracking-widest shadow-skeuo-flat"
          >
            Baixar extensão Chrome (v1.0.0)
          </a>
          
          <button
            onClick={() => setShowTutorial(!showTutorial)}
            className="text-[9px] font-bold text-kinetic-orange uppercase tracking-widest hover:underline text-center"
          >
            {showTutorial ? 'Esconder tutorial de instalação' : 'Ver tutorial de instalação'}
          </button>
        </div>
        
        {showTutorial && (
          <div className="p-1 animate-in fade-in slide-in-from-top-1 space-y-2 mt-3">
            
            <div className="grid grid-cols-1 gap-2">
              <div className="bg-deep-void/60 rounded-lg p-3 border border-white/5 space-y-1.5 shadow-skeuo-pressed">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/80">1. Baixar e extrair</p>
                <p className="text-[10px] text-white/50 leading-relaxed">
                  Baixe o arquivo ZIP clicando no botão acima e <strong>descompacte/extraia</strong> em uma pasta no seu computador.
                </p>
              </div>

              <div className="bg-deep-void/60 rounded-lg p-3 border border-white/5 space-y-1.5 shadow-skeuo-pressed">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/80">2. Instalar no Chrome</p>
                <p className="text-[10px] text-white/50 leading-relaxed">
                  Acesse <span className="font-mono text-kinetic-orange bg-kinetic-orange/10 px-1 py-0.5 rounded text-[9px]">chrome://extensions</span> no seu navegador. 
                  Ative o &quot;Modo do desenvolvedor&quot; (no canto superior direito), clique em &quot;Carregar sem compactação&quot; e selecione a <strong>pasta descompactada</strong>. Fixe a extensão na barra do Chrome.
                </p>
              </div>

              <div className="bg-deep-void/60 rounded-lg p-3 border border-white/5 space-y-1.5 shadow-skeuo-pressed">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/80">3. Parear e sincronizar</p>
                <p className="text-[10px] text-white/50 leading-relaxed">
                  Gere o código abaixo, cole na extensão e clique em &quot;Conectar&quot;. Depois, acesse o Mercado Livre no Chrome e clique em &quot;Sincronizar agora&quot; na extensão.
                </p>
              </div>
            </div>
            
            <div className="p-3 mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-2">
              <p className="text-[9px] text-amber-500 uppercase tracking-widest font-black flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Avisos importantes
              </p>
              <ul className="text-[9px] text-white/50 leading-relaxed list-disc list-inside space-y-1">
                <li>Você deve selecionar a pasta extraída, não o arquivo ZIP.</li>
                <li>Você precisa estar logado no Mercado Livre no mesmo Chrome.</li>
                <li>Se a sessão expirar, basta clicar em &quot;Sincronizar agora&quot; na extensão.</li>
                <li>A extensão <strong>não</strong> envia ou salva sua senha do Mercado Livre.</li>
              </ul>
            </div>

          </div>
        )}
      </div>

      {showDisconnectConfirm && (
        <div className="space-y-4 p-4 rounded-xl border border-red-500/20 bg-red-500/10 mb-4 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Desconectar sessão atual?</p>
              <p className="text-[9px] text-red-400/80 tracking-tighter leading-tight">
                Você já possui uma conexão ativa. Gerar um novo código irá revogar imediatamente sua sessão e tokens atuais.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button onClick={() => setShowDisconnectConfirm(false)} className="h-8 flex-1 rounded-lg border text-[9px] font-black uppercase tracking-widest bg-deep-void/50 border-white/5 text-white/40 hover:text-white/60">
              Cancelar
            </button>
            <KineticButton onClick={confirmDisconnectAndGenerate} className="h-8 flex-1 bg-red-500 text-white hover:bg-red-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] text-[9px] font-black uppercase tracking-widest border-none">
              Desconectar e Gerar
            </KineticButton>
          </div>
        </div>
      )}

      {localStatus === 'idle' && !showDisconnectConfirm && (
        <div className="space-y-3">

          <KineticButton
            onClick={generateCode}
            className={cn(
              "h-10 w-full font-black uppercase tracking-widest text-[10px] transition-all",
              integrationStatus === 'session_ready' 
                ? "bg-deep-void/50 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/5 shadow-none" 
                : ""
            )}
          >
            {integrationStatus === 'session_ready' ? 'Gerar novo código de pareamento' : 'Gerar código de pareamento'}
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

          <div className="flex items-center gap-3">
            <KineticButton
              onClick={handleCopy}
              disabled={copied}
              className="h-10 flex-1 font-black uppercase tracking-widest text-[10px]"
            >
              {copied ? 'Copiado!' : <><Copy className="w-3.5 h-3.5 mr-2" /> Copiar código</>}
            </KineticButton>
            
            <button
              onClick={executeGenerateCode}
              className="flex items-center justify-center gap-2 h-10 w-10 rounded-lg border text-[9px] font-black uppercase tracking-widest bg-deep-void/50 border-white/5 text-white/40 hover:text-white/60 hover:border-white/10 transition-all shrink-0"
              title="Gerar novo código"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="text-center pt-2">
            {integrationStatus === 'not_paired' || integrationStatus === null ? (
              <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold animate-pulse">Aguardando conexão da extensão...</p>
            ) : integrationStatus === 'paired_no_session' ? (
              <p className="text-[9px] text-amber-400 uppercase tracking-widest font-bold">Extensão pareada. Clique em Sincronizar agora na extensão.</p>
            ) : integrationStatus === 'session_ready' ? (
              <>
                <p className="text-[9px] text-emerald-400 uppercase tracking-widest font-black">✅ Mercado Livre conectado com sucesso!</p>
              </>
            ) : null}
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
