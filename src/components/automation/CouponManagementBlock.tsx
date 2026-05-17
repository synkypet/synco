'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TactileCard } from '@/components/ui/TactileCard';
import { KineticButton } from '@/components/ui/KineticButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Ticket, 
  Clock, 
  Calendar, 
  RefreshCcw, 
  ExternalLink, 
  Trash2, 
  MoreVertical,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Settings2
} from 'lucide-react';
import { toast } from 'sonner';
import { AddManualCouponDialog } from './AddManualCouponDialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

interface CouponRule {
  id: string;
  item_type: 'coupon' | 'promo_landing';
  is_selected: boolean;
  is_active: boolean;
  interval_minutes: number;
  next_run_at: string | null;
  last_sent_at: string | null;
  coupon?: {
    coupon_label: string;
    code: string | null;
    redemption_url: string;
    affiliate_url?: string;
    source_url?: string;
  };
  promo_page?: {
    title: string;
    canonical_url?: string;
    raw_url?: string;
    source_url?: string;
  };
}

interface CouponManagementBlockProps {
  sourceId: string;
  routeId: string;
}

export function CouponManagementBlock({ sourceId, routeId }: CouponManagementBlockProps) {
  const [rules, setRules] = useState<CouponRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/shopee/automation-coupons/rules?sourceId=${sourceId}&routeId=${routeId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar regras');
      setRules(data.rules);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [sourceId, routeId]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/shopee/automation-coupons/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          payload: { sourceId, routeId }
        })
      });
      if (!response.ok) throw new Error('Erro ao sincronizar');
      toast.success('Regras sincronizadas com sucesso');
      fetchRules();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggle = async (ruleId: string, field: 'is_selected' | 'is_active', value: boolean) => {
    setIsUpdating(ruleId);
    try {
      const response = await fetch('/api/shopee/automation-coupons/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          payload: {
            ruleId,
            updates: { [field]: value }
          }
        })
      });
      if (!response.ok) throw new Error('Erro ao atualizar regra');
      
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, [field]: value } : r));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleIntervalChange = async (ruleId: string, minutes: number) => {
    if (minutes < 1) return;
    setIsUpdating(ruleId);
    try {
      const response = await fetch('/api/shopee/automation-coupons/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          payload: {
            ruleId,
            updates: { interval_minutes: minutes }
          }
        })
      });
      if (!response.ok) throw new Error('Erro ao atualizar intervalo');
      
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, interval_minutes: minutes } : r));
      toast.success(`Intervalo atualizado para ${minutes} min`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUpdating(null);
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return 'Nunca';
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const getCouponUrl = (coupon: any) => {
    if (!coupon) return undefined;
    return coupon.redemption_url || coupon.affiliate_url || coupon.source_url;
  };

  const getPromoPageUrl = (promoPage: any) => {
    if (!promoPage) return undefined;
    return promoPage.canonical_url || promoPage.raw_url || promoPage.source_url;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Ticket className="w-5 h-5 text-kinetic-orange" />
            Gestão de Cupons e Promoções
          </h3>
          <p className="text-xs text-gray-500">Selecione e agende o envio dos itens capturados</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleSync}
            disabled={isSyncing}
            className="gap-2 text-gray-400 hover:text-white hover:bg-transparent"
          >
            <RefreshCcw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            Sincronizar
          </Button>
          <AddManualCouponDialog sourceId={sourceId} routeId={routeId} onSuccess={fetchRules} />
        </div>
      </div>

      <div className="grid gap-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <TactileCard key={i} className="p-4 h-24 animate-pulse bg-anthracite-surface/50" />
          ))
        ) : rules.length === 0 ? (
          <div className="py-12 text-center space-y-3 bg-anthracite-surface/20 rounded-xl border border-dashed border-gray-800">
            <Ticket className="w-12 h-12 text-gray-700 mx-auto" />
            <p className="text-gray-500 text-sm">Nenhum cupom ou promoção encontrada para esta rota.</p>
            <Button variant="outline" size="sm" onClick={handleSync} className="bg-anthracite-surface border-none text-white hover:bg-deep-void">Sincronizar Agora</Button>
          </div>
        ) : (
          rules.map((rule) => {
            const hasRuleLink = rule.item_type === 'coupon' 
              ? !!getCouponUrl(rule.coupon) 
              : !!getPromoPageUrl(rule.promo_page);

            return (
              <TactileCard 
                key={rule.id} 
                className={`p-4 transition-all duration-300 ${!rule.is_active ? 'opacity-60 grayscale' : ''} ${rule.is_selected ? 'ring-1 ring-kinetic-orange/30' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Enviar?</div>
                    <Switch 
                      checked={rule.is_selected} 
                      onCheckedChange={(val) => handleToggle(rule.id, 'is_selected', val)}
                      className="data-[state=checked]:bg-kinetic-orange"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${rule.item_type === 'coupon' ? 'border-kinetic-orange text-kinetic-orange' : 'border-blue-500 text-blue-500'}`}>
                        {rule.item_type === 'coupon' ? 'CUPOM' : 'PROMO'}
                      </Badge>
                      <span className="text-white font-medium text-sm truncate">
                        {rule.item_type === 'coupon' ? rule.coupon?.coupon_label : rule.promo_page?.title}
                      </span>
                      {rule.item_type === 'coupon' && rule.coupon?.code && (
                        <span className="bg-deep-void px-1.5 py-0.5 rounded text-[10px] font-mono text-gray-400 border border-gray-800">
                          {rule.coupon.code}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-[10px] text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Último: {formatTime(rule.last_sent_at)} ({formatDate(rule.last_sent_at)})
                      </div>
                      <div className="flex items-center gap-1 text-kinetic-orange">
                        <Calendar className="w-3 h-3" />
                        Próximo: {formatTime(rule.next_run_at)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Intervalo (min)</div>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="number"
                          className="h-7 w-16 bg-deep-void border-none text-[12px] text-center p-0"
                          value={rule.interval_minutes}
                          onChange={(e) => setRules(prev => prev.map(r => r.id === rule.id ? { ...r, interval_minutes: parseInt(e.target.value) || 1 } : r))}
                          onBlur={(e) => handleIntervalChange(rule.id, parseInt(e.target.value) || 30)}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Ativo</div>
                      <Switch 
                        checked={rule.is_active} 
                        onCheckedChange={(val) => handleToggle(rule.id, 'is_active', val)}
                        className="data-[state=checked]:bg-green-500"
                      />
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-transparent">
                          <MoreVertical className="w-4 h-4 text-gray-500" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-anthracite-surface border-none text-white">
                        <DropdownMenuItem 
                          onClick={() => {
                            const url = rule.item_type === 'coupon' 
                              ? getCouponUrl(rule.coupon) 
                              : getPromoPageUrl(rule.promo_page);
                            if (url) {
                              window.open(url, '_blank');
                            }
                          }}
                          disabled={!hasRuleLink}
                          className={`gap-2 ${!hasRuleLink ? 'opacity-50 cursor-not-allowed text-white/20' : ''}`}
                        >
                          <ExternalLink className="w-4 h-4" /> Ver Origem
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-red-500">
                          <Trash2 className="w-4 h-4" /> Remover Regra
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                
                {rule.item_type === 'promo_landing' && (
                  <div className="mt-2 p-2 rounded bg-green-500/5 border border-green-500/10 flex items-center gap-2 text-[10px] text-green-500/80">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    Envio recorrente automático ativado e totalmente suportado.
                  </div>
                )}
              </TactileCard>
            );
          })
        )}
      </div>
    </div>
  );
}
