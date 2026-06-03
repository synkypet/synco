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
      <p className="text-[11px] text-white/30 uppercase tracking-widest mb-8 italic leading-relaxed">
        Integração com a Meta para cruzar gastos em anúncios com o crescimento real dos seus grupos no SyncoMetrics.
      </p>

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
            <div className="pt-4 flex flex-wrap gap-4 border-t border-white/5">
              <KineticButton 
                onClick={handleTestMeta} 
                disabled={isTestingMeta || !metaToken || !metaAccountId}
                className="h-12 px-8 font-black uppercase tracking-widest text-xs rounded-xl flex items-center gap-2"
              >
                {isTestingMeta && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isTestingMeta ? 'Conectando...' : 'Conectar e Salvar'}
              </KineticButton>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
