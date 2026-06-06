'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TactileCard } from '@/components/ui/TactileCard';
import { KineticButton } from '@/components/ui/KineticButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Ticket, 
  Clock, 
  RefreshCcw, 
  ExternalLink, 
  Trash2, 
  ChevronDown,
  ChevronUp,
  Settings2
} from 'lucide-react';
import { toast } from 'sonner';
import { AddManualCouponDialog } from './AddManualCouponDialog';
import { Input } from '@/components/ui/input';

interface CouponRule {
  id: string;
  item_type: 'coupon' | 'promo_landing';
  is_selected: boolean;
  is_active: boolean;
  sort_order: number;
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
  const [routeData, setRouteData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/shopee/automation-coupons/rules?sourceId=${sourceId}&routeId=${routeId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar regras');
      
      const sortedRules = (data.rules || []).sort((a: CouponRule, b: CouponRule) => {
        return (a.sort_order || 0) - (b.sort_order || 0);
      });
      setRules(sortedRules);
      if (data.route) {
        setRouteData(data.route);
      }
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

  const updateSortOrder = async (ruleId: string, newOrder: number) => {
    try {
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, sort_order: newOrder } : r).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
      await fetch('/api/shopee/automation-coupons/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          payload: { ruleId, updates: { sort_order: newOrder } }
        })
      });
    } catch (error: any) {
      toast.error('Erro ao atualizar ordenação');
      fetchRules();
    }
  };

  const moveUp = (index: number, rule: CouponRule, list: CouponRule[]) => {
    if (index === 0) return;
    const prev = list[index - 1];
    updateSortOrder(rule.id, (prev.sort_order || 0) - 1);
  };

  const moveDown = (index: number, rule: CouponRule, list: CouponRule[]) => {
    if (index === list.length - 1) return;
    const next = list[index + 1];
    updateSortOrder(rule.id, (next.sort_order || 0) + 1);
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkToggleSend = async (val: boolean) => {
    if (selectedIds.size === 0) return;
    try {
      await Promise.all(Array.from(selectedIds).map(id => 
        fetch('/api/shopee/automation-coupons/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            payload: { ruleId: id, updates: { is_selected: val } }
          })
        })
      ));
      toast.success(`Itens ${val ? 'incluídos' : 'excluídos'} do envio.`);
      fetchRules();
      setSelectedIds(new Set());
    } catch (e: any) {
      toast.error('Erro ao atualizar itens');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      const response = await fetch('/api/shopee/automation-coupons/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_delete',
          payload: { ids: Array.from(selectedIds) }
        })
      });
      if (!response.ok) throw new Error();
      toast.success('Itens removidos da automação');
      fetchRules();
      setSelectedIds(new Set());
    } catch (e: any) {
      toast.error('Erro ao remover itens');
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getUrl = (rule: CouponRule) => {
    if (rule.item_type === 'coupon') return rule.coupon?.redemption_url || rule.coupon?.affiliate_url;
    return rule.promo_page?.canonical_url || rule.promo_page?.raw_url;
  };

  const couponsList = rules.filter(r => r.item_type === 'coupon');
  const promosList = rules.filter(r => r.item_type === 'promo_landing');

  const renderList = (list: CouponRule[], title: string) => (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
        {title} <Badge variant="outline" className="text-[10px] ml-2">{list.length}</Badge>
      </h4>
      {list.length === 0 ? (
        <div className="py-8 text-center bg-anthracite-surface/20 rounded-xl border border-dashed border-gray-800">
          <p className="text-gray-500 text-xs">Nenhum item encontrado.</p>
        </div>
      ) : (
        list.map((rule, index) => {
          const url = getUrl(rule);
          return (
            <TactileCard 
              key={rule.id} 
              className={`p-3 transition-all duration-300 flex items-center gap-3 ${!rule.is_selected ? 'opacity-50' : 'ring-1 ring-kinetic-orange/30'}`}
            >
              <Checkbox 
                checked={selectedIds.has(rule.id)}
                onCheckedChange={() => toggleSelect(rule.id)}
              />
              <div className="flex flex-col gap-1 items-center">
                <Button variant="ghost" size="sm" className="h-4 w-4 p-0 text-gray-500 hover:text-white" onClick={() => moveUp(index, rule, list)} disabled={index === 0}>
                  <ChevronUp className="w-3 h-3" />
                </Button>
                <span className="text-[8px] font-mono text-gray-600">{rule.sort_order || 0}</span>
                <Button variant="ghost" size="sm" className="h-4 w-4 p-0 text-gray-500 hover:text-white" onClick={() => moveDown(index, rule, list)} disabled={index === list.length - 1}>
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                <span className="text-white font-medium text-xs truncate">
                  {rule.item_type === 'coupon' ? rule.coupon?.coupon_label : rule.promo_page?.title}
                </span>
                <div className="flex items-center gap-2 text-[9px] text-gray-500 mt-1">
                  {rule.item_type === 'coupon' && rule.coupon?.code && (
                    <span className="bg-deep-void px-1 rounded font-mono text-gray-400 border border-gray-800">
                      {rule.coupon.code}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Envio: {formatTime(rule.last_sent_at)}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {url && (
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => window.open(url, '_blank')}>
                    <ExternalLink className="w-3 h-3 text-gray-400" />
                  </Button>
                )}
              </div>
            </TactileCard>
          );
        })
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Ticket className="w-5 h-5 text-kinetic-orange" />
            Gestão de Cupons e Promoções
          </h3>
          <p className="text-xs text-gray-500">Selecione e ordene os itens que serão enviados na automação.</p>
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

      {selectedIds.size > 0 && (
        <div className="p-3 bg-kinetic-orange/10 border border-kinetic-orange/20 rounded-xl flex items-center justify-between animate-in fade-in">
          <span className="text-xs font-bold text-kinetic-orange">{selectedIds.size} itens selecionados</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => handleBulkToggleSend(true)}>Habilitar Envio</Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => handleBulkToggleSend(false)}>Pausar Envio</Button>
            <Button size="sm" variant="destructive" className="h-7 text-[10px]" onClick={handleBulkDelete}><Trash2 className="w-3 h-3 mr-1" /> Remover da Automação</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-6">
          <TactileCard className="p-4 h-64 animate-pulse bg-anthracite-surface/50" />
          <TactileCard className="p-4 h-64 animate-pulse bg-anthracite-surface/50" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6 items-start">
          {renderList(couponsList, 'Cupons Capturados')}
          {renderList(promosList, 'Páginas Promocionais')}
        </div>
      )}
    </div>
  );
}
