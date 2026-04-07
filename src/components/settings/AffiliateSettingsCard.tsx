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
  ShieldCheck
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
  const [isActive, setIsActive] = useState(connection?.is_active ?? false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setAffiliateId(connection?.affiliate_id || '');
    setAffiliateCode(connection?.affiliate_code || '');
    setIsActive(connection?.is_active ?? false);
  }, [connection]);

  useEffect(() => {
    const changed = 
      affiliateId !== (connection?.affiliate_id || '') ||
      affiliateCode !== (connection?.affiliate_code || '') ||
      isActive !== (connection?.is_active ?? false);
    setHasChanges(changed);
  }, [affiliateId, affiliateCode, isActive, connection]);

  const isConfigured = !!affiliateId;
  const isShopee = marketplace.name.toLowerCase() === 'shopee';

  const handleSave = () => {
    onSave({
      ...(connection?.id ? { id: connection.id } : {}),
      marketplace_id: marketplace.id,
      affiliate_id: affiliateId,
      affiliate_code: affiliateCode,
      is_active: isActive
    });
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
          <div className="flex items-center gap-2">
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
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">
              {isShopee ? 'mmp_pid (ID de Afiliado)' : 'ID de Afiliado / Publisher'}
            </Label>
            {isShopee && (
              <a 
                href="https://affiliate.shopee.com.br/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[9px] font-bold text-kinetic-orange hover:underline flex items-center gap-1"
              >
                Onde encontrar? <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
          <Input 
            value={affiliateId}
            onChange={(e) => setAffiliateId(e.target.value)}
            placeholder={isShopee ? "Ex: AN_12345678" : "Insira seu ID"}
            className="bg-deep-void border-none shadow-skeuo-pressed text-xs font-mono h-11 focus-visible:ring-1 focus-visible:ring-kinetic-orange/30 rounded-xl"
          />
        </div>

        {isShopee && (
          <div className="space-y-2 animate-in slide-in-from-top-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-white/40">
              utm_source (Código Opcional)
            </Label>
            <Input 
              value={affiliateCode}
              onChange={(e) => setAffiliateCode(e.target.value)}
              placeholder="Ex: synco_wa"
              className="bg-deep-void border-none shadow-skeuo-pressed text-xs font-mono h-11 focus-visible:ring-1 focus-visible:ring-kinetic-orange/30 rounded-xl"
            />
          </div>
        )}
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
        disabled={isSaving || !hasChanges}
        className="h-12 w-full font-black uppercase tracking-widest text-xs"
      >
        {isSaving ? (
          <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Salvando...</>
        ) : (
          <><ShieldCheck className="w-3.5 h-3.5 mr-2" /> Salvar Configuração</>
        )}
      </KineticButton>
    </TactileCard>
  );
}
