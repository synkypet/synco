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
import { MercadoLivreExtensionPairing } from './MercadoLivreExtensionPairing';

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
  const [mattTool, setMattTool] = useState(connection?.ml_matt_tool || '');
  const [partnerId, setPartnerId] = useState(connection?.ml_partner_id || '');
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
    setMattTool(connection?.ml_matt_tool || '');
    setPartnerId(connection?.ml_partner_id || '');
    setIsActive(connection?.is_active ?? false);
  }, [connection]);

  useEffect(() => {
    const changed = 
      affiliateId !== (connection?.affiliate_id || '') ||
      affiliateCode !== (connection?.affiliate_code || '') ||
      shopeeAppId !== (connection?.shopee_app_id || '') ||
      shopeeAppSecret !== '' ||
      mattTool !== (connection?.ml_matt_tool || '') ||
      partnerId !== (connection?.ml_partner_id || '') ||
      isActive !== (connection?.is_active ?? false);
    setHasChanges(changed);
  }, [affiliateId, affiliateCode, shopeeAppId, shopeeAppSecret, mattTool, partnerId, isActive, connection]);

  const isShopee = marketplace.name.toLowerCase() === 'shopee';
  const normalizedName = marketplace?.name?.toLowerCase().replace(/\s+/g, '');
  const isMercadoLivre = normalizedName === 'mercadolivre';
  const isConfigured = isShopee ? !!shopeeAppId : isMercadoLivre ? (!!mattTool && !!partnerId) : !!affiliateId;

  const handleSave = async () => {
    setIsInjectingSecret(true);

    try {
      if (shopeeAppSecret) {
        const response = await fetch('/api/settings/secrets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            marketplace_id: marketplace.id,
            secret: shopeeAppSecret,
            shopee_app_id: shopeeAppId
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
        ml_matt_tool: mattTool,
        ml_partner_id: partnerId,
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
      const response = await fetch('/api/marketplaces/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplace_id: marketplace.id })
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
          {connection?.connection_status === 'connected' ? (
            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-emerald-500/20 px-2 h-6 shadow-skeuo-pressed bg-emerald-500/10 text-emerald-500">
              <ShieldCheck className="w-3 h-3 mr-1" /> Conectado
            </Badge>
          ) : connection?.connection_status === 'error' ? (
            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-red-500/20 px-2 h-6 shadow-skeuo-pressed bg-red-500/10 text-red-500">
              <AlertCircle className="w-3 h-3 mr-1" /> Erro na conexão
            </Badge>
          ) : connection?.connection_status === 'pending_verification' ? (
            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-amber-500/20 px-2 h-6 shadow-skeuo-pressed bg-amber-500/10 text-amber-500">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Verificação pendente
            </Badge>
          ) : connection?.connection_status === 'configured' ? (
            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-blue-500/20 px-2 h-6 shadow-skeuo-pressed bg-blue-500/10 text-blue-400">
              <ShieldCheck className="w-3 h-3 mr-1" /> Credenciais salvas
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-white/5 px-2 h-6 shadow-skeuo-pressed bg-deep-void text-white/40">
              Não conectado
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
          {!isShopee && !isMercadoLivre && (
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

          {isMercadoLivre && (
            <div className="space-y-4 animate-in slide-in-from-top-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">
                  Matt Tool ID
                </Label>
                <Input 
                  value={mattTool}
                  onChange={(e) => setMattTool(e.target.value)}
                  placeholder="Ex: 90237257"
                  className="bg-deep-void border-none shadow-skeuo-pressed text-xs font-mono h-11 focus-visible:ring-1 focus-visible:ring-kinetic-orange/30 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">
                  Partner ID (username)
                </Label>
                <Input 
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                  placeholder="Ex: liyu9461230"
                  className="bg-deep-void border-none shadow-skeuo-pressed text-xs font-mono h-11 focus-visible:ring-1 focus-visible:ring-kinetic-orange/30 rounded-xl"
                />
              </div>

              <MercadoLivreExtensionPairing />
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
                  <div className="pt-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-500">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTesting}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all",
                        connection.connection_status === 'connected'
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                          : connection.connection_status === 'error'
                          ? "bg-red-500/10 border-red-500/20 text-red-400"
                          : (connection.connection_status === 'pending_verification' || connection.connection_status === 'configured')
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          : "bg-deep-void/50 border-white/5 text-white/40 hover:text-white/60 hover:border-white/10"
                      )}
                    >
                      {isTesting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-3 h-3" />
                      )}
                      {isTesting ? 'Verificando...' : (connection.connection_status === 'error' ? 'Testar novamente' : 'Testar Conexão')}
                    </button>

                    {(testResult?.message || connection.last_error || connection.connection_status === 'pending_verification' || connection.connection_status === 'configured') && (
                      <p className={cn(
                        "text-[9px] font-bold uppercase tracking-tighter leading-tight",
                        (testResult?.valid || connection.connection_status === 'connected') ? "text-emerald-500/70" : (connection.connection_status === 'pending_verification' || connection.connection_status === 'configured' ? "text-amber-500/70" : "text-red-400")
                      )}>
                        {testResult?.message || connection.last_error || 
                         (connection.connection_status === 'configured' && 'Suas credenciais foram salvas com segurança. Clique em Testar conexão para validar com a Shopee.') ||
                         (connection.connection_status === 'pending_verification' && 'Configuração salva. Verificação em andamento...')}
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
