// src/components/settings/AffiliateSettingsCard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { TactileCard } from '@/components/ui/TactileCard';
import { KineticButton } from '@/components/ui/KineticButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  HelpCircle, 
  Info,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Marketplace, UserMarketplaceConnection } from '@/types/marketplace';
import { cn } from '@/lib/utils';

interface AffiliateSettingsCardProps {
  marketplace: Marketplace;
  connection?: UserMarketplaceConnection;
  isSaving: boolean;
  onSave: (data: Partial<UserMarketplaceConnection>) => void;
}

export function AffiliateSettingsCard({ 
  marketplace, 
  connection, 
  isSaving, 
  onSave 
}: AffiliateSettingsCardProps) {
  const [affiliateId, setAffiliateId] = useState(connection?.affiliate_id || '');
  const [affiliateCode, setAffiliateCode] = useState(connection?.affiliate_code || '');
  const [shopeeAppId, setShopeeAppId] = useState(connection?.shopee_app_id || '');
  const [shopeeAppSecret, setShopeeAppSecret] = useState(''); // Always blank on load for security
  const [isActive, setIsActive] = useState(connection?.is_active ?? false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isInjectingSecret, setIsInjectingSecret] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  useEffect(() => {
    setAffiliateId(connection?.affiliate_id || '');
    setAffiliateCode(connection?.affiliate_code || '');
    setShopeeAppId(connection?.shopee_app_id || '');
    setShopeeAppSecret('');
    setIsActive(connection?.is_active ?? false);
  }, [connection]);

  useEffect(() => {
    const changed = 
      affiliateId !== (connection?.affiliate_id || '') ||
      affiliateCode !== (connection?.affiliate_code || '') ||
      shopeeAppId !== (connection?.shopee_app_id || '') ||
      shopeeAppSecret !== '' ||
      isActive !== (connection?.is_active ?? false);
    setHasChanges(changed);
  }, [affiliateId, affiliateCode, shopeeAppId, shopeeAppSecret, isActive, connection]);

  const isShopee = marketplace.name.toLowerCase() === 'shopee';
  const isConfigured = isShopee ? !!shopeeAppId : !!affiliateId;

  const handleSave = async () => {
    setIsInjectingSecret(true);

    try {
      if (shopeeAppSecret) {
        const response = await fetch('/api/settings/secrets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            marketplace_id: marketplace.id,
            secret: shopeeAppSecret
          })
        });

        if (!response.ok) {
          throw new Error('Falha ao instanciar segredo');
        }
      }

      onSave({
        ...(connection?.id ? { id: connection.id } : {}),
        marketplace_id: marketplace.id,
        affiliate_id: affiliateId,
        affiliate_code: affiliateCode,
        shopee_app_id: shopeeAppId,
        has_secret: shopeeAppSecret ? true : connection?.has_secret,
        is_active: isActive
      });

      // Clear the local state secret input proactively after successfully storing it
      setShopeeAppSecret('');
      setTestResult(null); // Reset test status on save
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsInjectingSecret(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/settings/marketplaces/shopee/test', {
        method: 'POST'
      });
      const data = await response.json();
      setTestResult({
        valid: data.valid,
        message: data.message
      });
    } catch (e: any) {
      setTestResult({
        valid: false,
        message: 'Erro ao tentar conectar com a Shopee.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <TactileCard className={cn(
      "p-6 border-none flex flex-col gap-6 group transition-all duration-500",
      isActive ? "ring-1 ring-kinetic-orange/20 shadow-glow-orange/5" : "opacity-80"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-deep-void shadow-skeuo-flat flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-500">
            {marketplace.name === 'Shopee' ? '🟠' : 
             marketplace.name === 'Mercado Livre' ? '🟡' : 
             marketplace.name === 'Amazon' ? '🔵' : '📦'}
          </div>
          <div className="flex flex-col">
            <h3 className="font-black text-sm uppercase tracking-widest font-headline">{marketplace.name}</h3>
            <span className="text-[10px] font-bold text-white/20 uppercase tracking-tighter">
              {marketplace.description || 'Programa de Afiliados'}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge 
            variant="outline" 
            className={cn(
              "text-[9px] font-black uppercase tracking-widest border-none px-2 h-6 shadow-skeuo-pressed",
              isConfigured ? "bg-emerald-500/10 text-emerald-500" : "bg-deep-void text-white/20"
            )}
          >
            {isConfigured ? 'Parametrizado' : 'Pendente'}
          </Badge>
          {isShopee && connection?.has_secret && (
            <Badge 
              variant="outline" 
              className="text-[9px] font-black uppercase tracking-widest border-none px-2 h-6 shadow-skeuo-pressed bg-kinetic-orange/10 text-kinetic-orange flex items-center gap-1 mt-1"
            >
              <ShieldCheck className="w-3 h-3" /> API Configurada
            </Badge>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Ativo</span>
            <Switch 
              checked={isActive} 
              onCheckedChange={setIsActive}
              className="data-[state=checked]:bg-kinetic-orange"
            />
          </div>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-6">
          {!isShopee && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">
                  ID de Afiliado / Publisher
                </Label>
              </div>
              <Input 
                value={affiliateId}
                onChange={(e) => setAffiliateId(e.target.value)}
                placeholder="Insira seu ID"
                className="bg-deep-void border-none shadow-skeuo-pressed text-xs font-mono h-11 focus-visible:ring-1 focus-visible:ring-kinetic-orange/30 rounded-xl"
              />
            </div>
          )}

          {isShopee && (
            <div className="space-y-4 animate-in slide-in-from-top-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">AppID da Shopee</Label>
                <Input 
                  value={shopeeAppId}
                  onChange={(e) => setShopeeAppId(e.target.value)}
                  placeholder="Ex: 123456789"
                  className="bg-deep-void border-none shadow-skeuo-pressed text-xs font-mono h-11 focus-visible:ring-1 focus-visible:ring-kinetic-orange/30 rounded-xl"
                />
                <p className="text-[8px] text-white/20 tracking-tighter leading-tight mt-1">Cole aqui o AppID que aparece na área “Abrir API” da Shopee.</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">Senha da API da Shopee</Label>
                  {connection?.has_secret && (
                    <Badge variant="outline" className="h-4 px-1.5 text-[7px] border-emerald-500/20 bg-emerald-500/5 text-emerald-400 font-black uppercase tracking-widest">
                      Senha Cadastrada
                    </Badge>
                  )}
                </div>
                <Input 
                  type="password"
                  value={shopeeAppSecret}
                  onChange={(e) => setShopeeAppSecret(e.target.value)}
                  placeholder={connection?.has_secret ? "••••••••••••••••••••••••" : "Cole a senha/chave"}
                  className="bg-deep-void border-none shadow-skeuo-pressed text-xs font-mono h-11 focus-visible:ring-1 focus-visible:ring-kinetic-orange/30 rounded-xl placeholder:tracking-[0.2em]"
                />
                <div className="space-y-1">
                  <p className="text-[8px] text-white/20 tracking-tighter leading-tight">
                    {connection?.has_secret 
                      ? "Uma chave já está salva com segurança. Para trocar, digite uma nova e salve."
                      : "Cole aqui a senha/chave que aparece na área “Abrir API” da Shopee."}
                  </p>
                  {connection?.updated_at && connection.has_secret && (
                    <p className="text-[7px] text-white/10 uppercase font-bold tracking-widest">
                      Última atualização: {new Date(connection.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' } as any)}
                    </p>
                  )}
                </div>

                {connection?.has_secret && (
                  <div className="pt-2 animate-in fade-in slide-in-from-top-1 duration-500">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTesting}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all",
                        testResult?.valid 
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                          : testResult?.valid === false
                          ? "bg-red-500/10 border-red-500/20 text-red-400 col-span-2"
                          : "bg-deep-void/50 border-white/5 text-white/40 hover:text-white/60 hover:border-white/10"
                      )}
                    >
                      {isTesting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-3 h-3" />
                      )}
                      {isTesting ? 'Validando...' : 'Testar Conexão Open API'}
                    </button>

                    {testResult && (
                      <p className={cn(
                        "mt-2 text-[8px] font-bold uppercase tracking-tighter leading-tight",
                        testResult.valid ? "text-emerald-500/70" : "text-red-400"
                      )}>
                        {testResult.message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Remove the redundant Shopee block since we moved it above */}
      </div>

      {/* Status & Validation */}
      <div className="p-4 bg-deep-void/50 rounded-xl border-none shadow-skeuo-pressed flex items-start gap-3">
        {isConfigured ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className="w-4 h-4 text-kinetic-orange/50 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex flex-col gap-1">
          <p className="text-[9px] font-black uppercase tracking-widest text-white/40 leading-tight">
            {isConfigured 
              ? 'Pronto para processamento real.' 
              : 'ID obrigatório para converter links.'}
          </p>
          {isActive && !isConfigured && (
            <p className="text-[8px] font-bold text-kinetic-orange uppercase tracking-tighter animate-pulse">
              Aviso: Configuração ativa sem ID detectado
            </p>
          )}
        </div>
      </div>

      {/* Action */}
      <KineticButton 
        onClick={handleSave}
        disabled={isSaving || isInjectingSecret || !hasChanges}
        className="h-12 w-full font-black uppercase tracking-widest text-xs"
      >
        {isSaving || isInjectingSecret ? (
          <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Salvando...</>
        ) : (
          <><ShieldCheck className="w-3.5 h-3.5 mr-2" /> Salvar Configuração</>
        )}
      </KineticButton>
    </TactileCard>
  );
}
