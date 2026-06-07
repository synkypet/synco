'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TactileCard } from '@/components/ui/TactileCard';
import { KineticButton } from '@/components/ui/KineticButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { 
  Ticket, 
  Clock, 
  RefreshCcw, 
  ExternalLink, 
  Trash2, 
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  CheckCircle2,
  Edit,
  Copy,
  Plus,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { AddManualCouponDialog } from './AddManualCouponDialog';

interface CouponRule {
  id: string;
  item_type: 'coupon' | 'promo_landing';
  is_selected: boolean;
  is_active: boolean;
  sort_order: number;
  last_sent_at: string | null;
  coupon_id?: string;
  promo_page_id?: string;
  coupon?: {
    coupon_label: string;
    code: string | null;
    redemption_url: string;
    affiliate_url?: string;
    source_url?: string;
    custom_description?: string;
    raw_text?: string;
    is_manual?: boolean;
    image_url?: string;
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
  
  // Media State
  const [useSameImage, setUseSameImage] = useState(true);
  const [globalUrl, setGlobalUrl] = useState('');
  const [couponUrl, setCouponUrl] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [isSavingMedia, setIsSavingMedia] = useState(false);

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
        const media = data.route.template_config?.media || {};
        setUseSameImage(media.use_same_for_all ?? true);
        setGlobalUrl(media.global_url || '');
        setCouponUrl(media.coupon_url || '');
        setPageUrl(media.page_url || '');
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

  const handleSaveMedia = async () => {
    setIsSavingMedia(true);
    try {
      const currentConfig = routeData?.template_config || {};
      const updates = {
        template_config: {
          ...currentConfig,
          media: {
            use_same_for_all: useSameImage,
            global_url: globalUrl,
            coupon_url: couponUrl,
            page_url: pageUrl
          }
        }
      };
      
      const response = await fetch('/api/shopee/automation-coupons/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_route',
          payload: { routeId, updates }
        })
      });
      if (!response.ok) throw new Error();
      toast.success('Imagens salvas com sucesso!');
      fetchRules();
    } catch(e) {
      toast.error('Erro ao salvar imagens.');
    } finally {
      setIsSavingMedia(false);
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

  const toggleSelectedForSend = async (ruleId: string, val: boolean) => {
    try {
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, is_selected: val } : r));
      await fetch('/api/shopee/automation-coupons/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          payload: { ruleId, updates: { is_selected: val } }
        })
      });
      toast.success(val ? 'Adicionado ao envio' : 'Removido do envio');
    } catch (e: any) {
      toast.error('Erro ao atualizar');
      fetchRules();
    }
  };

  const handleRemoveRule = async (ruleId: string) => {
    try {
      await fetch('/api/shopee/automation-coupons/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_delete',
          payload: { ids: [ruleId] }
        })
      });
      toast.success('Removido da automação');
      fetchRules();
    } catch (e: any) {
      toast.error('Erro ao remover');
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
  
  const getDescription = (rule: CouponRule) => {
    if (rule.item_type === 'coupon') {
      return rule.coupon?.custom_description || rule.coupon?.raw_text?.substring(0, 50) || '';
    }
    return '';
  };

  const couponsList = rules.filter(r => r.item_type === 'coupon');
  const promosList = rules.filter(r => r.item_type === 'promo_landing');

  const renderList = (list: CouponRule[], title: string) => {
    const availableItems = list.filter(r => !r.is_selected);
    const selectedItems = list.filter(r => r.is_selected);
    
    return (
      <div className="flex flex-col gap-4">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          {title} <Badge variant="outline" className="text-[10px] ml-2">{list.length}</Badge>
        </h4>
        
        {selectedItems.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-xs font-semibold text-kinetic-orange uppercase tracking-wider mb-2">Selecionados para Envio</h5>
            {selectedItems.map((rule, index) => {
              const url = getUrl(rule);
              return (
                <TactileCard key={rule.id} className="p-3 ring-1 ring-kinetic-orange/30 flex flex-col gap-2 relative">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1 items-center mt-1">
                      <Button variant="ghost" size="sm" className="h-4 w-4 p-0 text-gray-500 hover:text-white" onClick={() => moveUp(index, rule, selectedItems)} disabled={index === 0}>
                        <ChevronUp className="w-3 h-3" />
                      </Button>
                      <span className="text-[8px] font-mono text-gray-600">{rule.sort_order || 0}</span>
                      <Button variant="ghost" size="sm" className="h-4 w-4 p-0 text-gray-500 hover:text-white" onClick={() => moveDown(index, rule, selectedItems)} disabled={index === selectedItems.length - 1}>
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <span className="text-white font-medium text-xs break-words">
                        {rule.item_type === 'coupon' ? rule.coupon?.coupon_label : rule.promo_page?.title}
                      </span>
                      {getDescription(rule) && (
                        <p className="text-[10px] text-gray-400 truncate">{getDescription(rule)}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-[9px] text-gray-500 mt-1">
                        {rule.item_type === 'coupon' && rule.coupon?.code && (
                          <span className="bg-deep-void px-1 rounded font-mono text-gray-400 border border-gray-800">
                            Código: {rule.coupon.code}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Último envio: {formatTime(rule.last_sent_at)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1 items-end">
                      {rule.item_type === 'coupon' && (
                        rule.coupon?.is_manual ? (
                          <AddManualCouponDialog sourceId={sourceId} routeId={routeId} onSuccess={fetchRules} couponToEdit={{ ...rule.coupon, id: rule.coupon_id }} />
                        ) : (
                          <AddManualCouponDialog sourceId={sourceId} routeId={routeId} onSuccess={fetchRules} couponToEdit={{ ...rule.coupon, id: undefined }} isClone />
                        )
                      )}
                      <Button size="sm" variant="outline" className="h-7 text-[10px] border-kinetic-orange/50 text-kinetic-orange hover:bg-kinetic-orange/10" onClick={() => toggleSelectedForSend(rule.id, false)}>
                        Remover do Envio
                      </Button>
                      {url && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 mt-1" onClick={() => window.open(url, '_blank')}>
                          <ExternalLink className="w-3 h-3 text-gray-400" />
                        </Button>
                      )}
                    </div>
                  </div>
                </TactileCard>
              );
            })}
          </div>
        )}

        {availableItems.length > 0 && (
          <div className="space-y-2 mt-4">
            <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Disponíveis (Não Enviados)</h5>
            {availableItems.map((rule) => {
              const url = getUrl(rule);
              return (
                <TactileCard key={rule.id} className="p-3 opacity-60 hover:opacity-100 transition-opacity">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <span className="text-gray-300 font-medium text-xs break-words">
                        {rule.item_type === 'coupon' ? rule.coupon?.coupon_label : rule.promo_page?.title}
                      </span>
                      {getDescription(rule) && (
                        <p className="text-[10px] text-gray-500 truncate">{getDescription(rule)}</p>
                      )}
                      {rule.item_type === 'coupon' && rule.coupon?.code && (
                        <div className="mt-1">
                          <span className="bg-deep-void px-1 rounded font-mono text-[9px] text-gray-400 border border-gray-800">
                            Código: {rule.coupon.code}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      {rule.item_type === 'coupon' && (
                        rule.coupon?.is_manual ? (
                          <AddManualCouponDialog sourceId={sourceId} routeId={routeId} onSuccess={fetchRules} couponToEdit={{ ...rule.coupon, id: rule.coupon_id }} />
                        ) : (
                          <AddManualCouponDialog sourceId={sourceId} routeId={routeId} onSuccess={fetchRules} couponToEdit={{ ...rule.coupon, id: undefined }} isClone />
                        )
                      )}
                      <Button size="sm" variant="secondary" className="h-7 text-[10px]" onClick={() => toggleSelectedForSend(rule.id, true)}>
                        <Plus className="w-3 h-3 mr-1" /> Incluir no Envio
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-[10px] text-red-400 hover:text-red-300" onClick={() => handleRemoveRule(rule.id)}>
                        <Trash2 className="w-3 h-3 mr-1" /> Excluir da Automação
                      </Button>
                    </div>
                  </div>
                </TactileCard>
              );
            })}
          </div>
        )}

        {list.length === 0 && (
          <div className="py-8 text-center bg-anthracite-surface/20 rounded-xl border border-dashed border-gray-800">
            <p className="text-gray-500 text-xs">Nenhum item encontrado.</p>
          </div>
        )}
      </div>
    );
  };

  const renderMediaSettings = () => {
    return (
      <TactileCard className="p-4 mb-6 bg-deep-void/40 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-kinetic-orange" />
            Configuração de Mídia
          </h4>
          <div className="flex items-center gap-2">
            <Checkbox 
              id="use-same-image"
              checked={useSameImage}
              onCheckedChange={(c) => setUseSameImage(c as boolean)}
            />
            <label htmlFor="use-same-image" className="text-xs text-gray-300 cursor-pointer">
              Usar a mesma imagem para cupons e páginas promocionais
            </label>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {useSameImage ? (
            <div className="col-span-full">
              <label className="text-xs font-semibold text-gray-400 mb-1 block">URL da Imagem Global (HTTPS)</label>
              <Input 
                value={globalUrl} 
                onChange={e => setGlobalUrl(e.target.value)} 
                placeholder="https://..." 
                className="bg-deep-void border-gray-800 text-xs"
              />
              <p className="text-[10px] text-gray-500 mt-1">A imagem precisa ser uma URL pública HTTPS acessível pelo WhatsApp/Wasender.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-semibold text-gray-400 mb-1 block">Imagem para Cupons</label>
                <Input 
                  value={couponUrl} 
                  onChange={e => setCouponUrl(e.target.value)} 
                  placeholder="https://..." 
                  className="bg-deep-void border-gray-800 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 mb-1 block">Imagem para Páginas Promocionais</label>
                <Input 
                  value={pageUrl} 
                  onChange={e => setPageUrl(e.target.value)} 
                  placeholder="https://..." 
                  className="bg-deep-void border-gray-800 text-xs"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <KineticButton disabled={isSavingMedia} onClick={handleSaveMedia}>
            {isSavingMedia ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ImageIcon className="w-4 h-4 mr-2" />}
            Salvar Mídia
          </KineticButton>
        </div>
      </TactileCard>
    );
  };

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

      {!isLoading && renderMediaSettings()}

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-6">
          <TactileCard className="p-4 h-64 animate-pulse bg-anthracite-surface/50" />
          <TactileCard className="p-4 h-64 animate-pulse bg-anthracite-surface/50" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6 items-start">
          {renderList(couponsList, 'Cupons')}
          {renderList(promosList, 'Páginas Promocionais')}
        </div>
      )}
    </div>
  );
}
