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

      <div className="p-6 rounded-[24px] bg-black/20 border border-white/5 shadow-skeuo-pressed">
        {metaConnection ? (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-zinc-200 font-semibold flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  Conectado
                </h3>
                <ul className="text-sm text-zinc-400 mt-2 space-y-1">
                  <li><strong>Conta:</strong> {metaConnection.name} ({metaConnection.adAccountId})</li>
                  <li><strong>Moeda:</strong> {metaConnection.currency}</li>
                  {metaConnection.pixelName && (
                    <li><strong>Pixel:</strong> {metaConnection.pixelName}</li>
                  )}
                  <li><strong>Último Teste:</strong> {new Date(metaConnection.lastTestedAt).toLocaleString('pt-BR')}</li>
                </ul>
              </div>
              <div className="flex flex-col gap-2 w-full sm:w-auto">
                <KineticButton 
                  onClick={() => setMetaConnection(null)} 
                  className="bg-zinc-800 text-zinc-300 w-full text-xs"
                >
                  Trocar Conta/Token
                </KineticButton>
                <KineticButton 
                  onClick={handleDisconnectMeta} 
                  className="bg-red-900/20 text-red-400 hover:bg-red-900/40 border border-red-900/50 w-full text-xs"
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
