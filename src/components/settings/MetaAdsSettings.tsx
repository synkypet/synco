"use client";

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { KineticButton } from '@/components/ui/KineticButton';
import { RefreshCw, TrendingUp } from 'lucide-react';

export function MetaAdsSettings() {
  const [metaConnection, setMetaConnection] = useState<any>(null);
  const [metaToken, setMetaToken] = useState('');
  const [metaAccountId, setMetaAccountId] = useState('');
  const [metaPixelId, setMetaPixelId] = useState('');
  const [isTestingMeta, setIsTestingMeta] = useState(false);
  const [metaTestError, setMetaTestError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [safetyChecked, setSafetyChecked] = useState(false);

  useEffect(() => {
    const fetchConnection = async () => {
      try {
        const res = await fetch('/api/synco-metrics/meta/connection');
        if (res.ok) {
          const data = await res.json();
          if (data.connected) {
            setMetaConnection(data.account);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchConnection();
  }, []);

  const handleTestMeta = async () => {
    if (!metaToken || !metaAccountId) {
      setMetaTestError("Preencha o Token e o Ad Account ID.");
      return;
    }
    
    setIsTestingMeta(true);
    setMetaTestError(null);

    try {
      const res = await fetch('/api/synco-metrics/meta/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: metaToken,
          adAccountId: metaAccountId,
          pixelId: metaPixelId
        })
      });

      const data = await res.json();
      setMetaToken(''); // Limpa token

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Erro desconhecido na conexão Meta');
      }

      setMetaConnection(data.account);
    } catch (err: any) {
      setMetaTestError(err.message);
    } finally {
      setIsTestingMeta(false);
    }
  };

  const handleDisconnectMeta = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/synco-metrics/meta/connection', {
        method: 'DELETE'
      });
      if (res.ok) {
        setMetaConnection(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <p className="text-zinc-500 animate-pulse">Carregando...</p>
      </div>
    );
  }

  return (
    <Card className="p-6 border-none ring-1 ring-white/5 bg-anthracite-surface/50">
      <div className="flex items-center gap-3 mb-2">
        <TrendingUp className="w-5 h-5 text-kinetic-orange" />
        <h3 className="font-bold text-lg font-headline italic">Conexão Meta Ads</h3>
      </div>
      <p className="text-[11px] text-white/30 uppercase tracking-widest mb-4 italic leading-relaxed">
        Integração com a Meta para cruzar gastos em anúncios com o crescimento real dos seus grupos no SyncoMetrics.
      </p>

      <div className="p-4 bg-zinc-900/40 border border-zinc-800/60 rounded-xl mb-8 max-w-3xl">
        <p className="text-sm text-zinc-400 leading-relaxed">
          Para maior estabilidade, gere um token com permissão <strong className="text-zinc-300">ads_read</strong> e use a opção <strong>Estender token de acesso</strong> no Meta Developers. Tokens curtos podem expirar rapidamente.
        </p>
        <p className="text-xs text-zinc-600 mt-2">
          Futuro: conexão oficial via OAuth para usuários SaaS externos.
        </p>
      </div>

      <div className="p-6 md:p-8 rounded-[24px] bg-black/20 border border-white/5 shadow-skeuo-pressed">
        {metaConnection ? (
          <div className="space-y-6 animate-fade-in w-full">
            <h3 className="text-zinc-200 font-headline italic font-bold flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-glow"></span>
              </span>
              Conectado
            </h3>
            
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
              <ul className="text-sm text-zinc-400 space-y-3 flex-1 break-words">
                <li className="flex items-center gap-2"><strong className="text-white/60 min-w-[100px]">Conta:</strong> <span className="text-white font-medium">{metaConnection.name}</span></li>
                <li className="flex items-center gap-2"><strong className="text-white/60 min-w-[100px]">ID da conta:</strong> <span className="font-mono text-xs">{metaConnection.adAccountId}</span></li>
                <li className="flex items-center gap-2"><strong className="text-white/60 min-w-[100px]">Moeda:</strong> {metaConnection.currency}</li>
                {metaConnection.pixelName && (
                  <li className="flex items-center gap-2"><strong className="text-white/60 min-w-[100px]">Pixel:</strong> {metaConnection.pixelName}</li>
                )}
                <li className="flex items-center gap-2"><strong className="text-white/60 min-w-[100px]">Último teste:</strong> {new Date(metaConnection.lastTestedAt).toLocaleString('pt-BR')}</li>
              </ul>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
                <KineticButton 
                  onClick={() => setMetaConnection(null)} 
                  className="bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white border border-white/10 shadow-skeuo-flat h-11 px-6 text-xs uppercase tracking-widest font-black w-full sm:w-auto justify-center"
                >
                  Trocar Conta/Token
                </KineticButton>
                <KineticButton 
                  onClick={handleDisconnectMeta} 
                  className="bg-red-900/20 text-red-400 hover:bg-red-500 hover:text-white border border-red-900/50 hover:border-red-500 shadow-skeuo-flat h-11 px-6 text-xs uppercase tracking-widest font-black transition-colors w-full sm:w-auto justify-center"
                >
                  Desconectar
                </KineticButton>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in max-w-xl">
            {metaTestError && (
              <div className="p-3 bg-red-900/20 border border-red-900/50 text-red-400 text-sm rounded-lg">
                {metaTestError}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 mb-2">
                <div className="p-4 border border-orange-500/50 bg-orange-950/20 rounded-xl flex gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    <TrendingUp className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <h4 className="font-bold text-orange-400 mb-2">Atenção antes de conectar a Meta</h4>
                    <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                      Para reduzir riscos de restrição, não use na Meta o mesmo número de telefone usado para automações/envios no WhatsApp.
                    </p>
                    <div className="space-y-4 mb-4">
                      <div>
                        <strong className="text-orange-400 block mb-1 text-sm">1. WhatsApp de envios do SYNCO:</strong>
                        <p className="text-sm text-zinc-400">Use um número dedicado apenas para operação dos grupos e automações.</p>
                      </div>
                      <div>
                        <strong className="text-orange-400 block mb-1 text-sm">2. Meta Business / Pixel / Token:</strong>
                        <p className="text-sm text-zinc-400">Use uma conta e número administrativo separados, sem ligação direta com o número usado para disparos no WhatsApp.</p>
                      </div>
                    </div>
                    
                    <p className="text-sm text-zinc-300 leading-relaxed mb-2">Evite usar o mesmo número para:</p>
                    <ul className="list-disc list-inside text-sm text-zinc-400 mb-4 space-y-1">
                      <li>conectar o WhatsApp no SYNCO;</li>
                      <li>enviar ofertas em grupos;</li>
                      <li>criar token da Meta;</li>
                      <li>administrar o Meta Business;</li>
                      <li>gerenciar Pixel;</li>
                      <li>rodar campanhas de anúncios.</li>
                    </ul>

                    <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                      Isso ajuda a reduzir sinais cruzados de automação entre WhatsApp, Meta Business, Pixel e anúncios.
                    </p>
                    
                    <p className="text-xs text-orange-500/70">
                      Essa recomendação não garante ausência de restrições, mas é uma prática de segurança para manter operações de WhatsApp e Meta Ads separadas.
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">ID da Conta de Anúncios</label>
                <input 
                  type="text" 
                  placeholder="act_123456789" 
                  value={metaAccountId}
                  onChange={(e) => setMetaAccountId(e.target.value)}
                  className="bg-deep-void border border-white/5 h-12 w-full px-4 text-xs font-black rounded-xl shadow-skeuo-pressed outline-none focus:ring-1 focus:ring-kinetic-orange/30 transition-all text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Pixel ID (Opcional)</label>
                <input 
                  type="text" 
                  placeholder="987654321" 
                  value={metaPixelId}
                  onChange={(e) => setMetaPixelId(e.target.value)}
                  className="bg-deep-void border border-white/5 h-12 w-full px-4 text-xs font-black rounded-xl shadow-skeuo-pressed outline-none focus:ring-1 focus:ring-kinetic-orange/30 transition-all text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Access Token (Permissão: ads_read)</label>
              <input 
                type="password" 
                placeholder="EAAB..." 
                value={metaToken}
                onChange={(e) => setMetaToken(e.target.value)}
                className="bg-deep-void border border-white/5 h-12 w-full px-4 text-xs font-mono rounded-xl shadow-skeuo-pressed outline-none focus:ring-1 focus:ring-kinetic-orange/30 transition-all text-white"
              />
            </div>
            <div className="pt-4 border-t border-white/5 space-y-4">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="mt-0.5">
                  <input 
                    type="checkbox" 
                    checked={safetyChecked}
                    onChange={(e) => setSafetyChecked(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-black/50 text-kinetic-orange focus:ring-kinetic-orange focus:ring-offset-0 focus:ring-offset-transparent cursor-pointer"
                  />
                </div>
                <span className="text-sm text-zinc-300 group-hover:text-white transition-colors leading-snug">
                  Entendi que devo evitar usar o mesmo número das automações do WhatsApp para administrar Meta Business, Pixel ou gerar token da Meta.
                </span>
              </label>

              <div className="flex flex-wrap gap-4">
                <KineticButton 
                  onClick={handleTestMeta} 
                  disabled={isTestingMeta || !metaToken || !metaAccountId || !safetyChecked}
                  className="h-12 px-8 font-black uppercase tracking-widest text-xs rounded-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTestingMeta && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {isTestingMeta ? 'Conectando...' : 'Conectar e Salvar'}
                </KineticButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
