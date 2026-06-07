'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TactileCard } from '@/components/ui/TactileCard';
import { KineticButton } from '@/components/ui/KineticButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { 
  Ticket, 
  Clock, 
  ExternalLink, 
  Trash2, 
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  CheckCircle2,
  Edit,
  Copy,
  Plus,
  Loader2,
  Upload
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
  coupon?: any;
  promo_page?: any;
}

interface CouponManagementBlockProps {
  sourceId: string;
  routeId: string;
}

export function CouponManagementBlock({ sourceId, routeId }: CouponManagementBlockProps) {
  const [rules, setRules] = useState<CouponRule[]>([]);
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
  const [availablePages, setAvailablePages] = useState<any[]>([]);
  const [routeData, setRouteData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Media State
  const [useSameImage, setUseSameImage] = useState(true);
  const [globalUrl, setGlobalUrl] = useState('');
  const [couponUrl, setCouponUrl] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [isUploading, setIsUploading] = useState<{ [key: string]: boolean }>({});

  const globalFileInputRef = useRef<HTMLInputElement>(null);
  const couponFileInputRef = useRef<HTMLInputElement>(null);
  const pageFileInputRef = useRef<HTMLInputElement>(null);

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

      // Filtrar já selecionados
      const selectedCouponIds = new Set(sortedRules.filter((r: CouponRule) => r.item_type === 'coupon').map((r: CouponRule) => r.coupon_id));
      const selectedPageIds = new Set(sortedRules.filter((r: CouponRule) => r.item_type === 'promo_landing').map((r: CouponRule) => r.promo_page_id));

      const filteredCoupons = (data.available_coupons || [])
        .filter((c: any) => !selectedCouponIds.has(c.id))
        .sort((a: any, b: any) => new Date(b.last_seen_at || b.updated_at || 0).getTime() - new Date(a.last_seen_at || a.updated_at || 0).getTime());

      const filteredPages = (data.available_promo_pages || [])
        .filter((p: any) => !selectedPageIds.has(p.id))
        .sort((a: any, b: any) => new Date(b.last_seen_at || b.updated_at || 0).getTime() - new Date(a.last_seen_at || a.updated_at || 0).getTime());

      setAvailableCoupons(filteredCoupons);
      setAvailablePages(filteredPages);

    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [sourceId, routeId]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleUploadMedia = async (file: File, type: 'global' | 'coupon' | 'page') => {
    setIsUploading(prev => ({ ...prev, [type]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      formData.append('use_same_for_all', useSameImage.toString());

      const res = await fetch(`/api/automation-routes/${routeId}/media`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success('Imagem enviada com sucesso!');
      if (type === 'global') setGlobalUrl(data.url);
      else if (type === 'coupon') setCouponUrl(data.url);
      else if (type === 'page') setPageUrl(data.url);
      
      fetchRules();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar imagem');
    } finally {
      setIsUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'global' | 'coupon' | 'page') => {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadMedia(file, type);
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

  const handleAddAvailable = async (item: any, type: 'coupon' | 'promo_landing') => {
    try {
      const rule: any = {
        source_id: sourceId,
        route_id: routeId,
        item_type: type,
        is_selected: true,
        is_active: true,
        sort_order: rules.length + 1
      };
      if (type === 'coupon') rule.coupon_id = item.id;
      else rule.promo_page_id = item.id;
      
      await fetch('/api/shopee/automation-coupons/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          payload: { rule }
        })
      });
      toast.success('Adicionado ao envio');
      fetchRules();
    } catch (e: any) {
      toast.error('Erro ao adicionar');
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
      toast.success('Removido do envio');
      fetchRules();
    } catch (e: any) {
      toast.error('Erro ao remover');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Link copiado!');
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const renderSelectedList = (list: CouponRule[], title: string) => {
    return (
      <div className="flex flex-col gap-4">
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          {title} <Badge variant="outline" className="text-[10px] ml-2">{list.length}</Badge>
        </h4>
        
        {list.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-xs font-semibold text-kinetic-orange uppercase tracking-wider mb-2">Selecionados para Envio</h5>
            {list.map((rule, index) => {
              const url = rule.item_type === 'coupon' ? (rule.coupon?.redemption_url || rule.coupon?.affiliate_url) : (rule.promo_page?.canonical_url || rule.promo_page?.raw_url);
              const label = rule.item_type === 'coupon' ? rule.coupon?.coupon_label : rule.promo_page?.title;
              const desc = rule.item_type === 'coupon' ? (rule.coupon?.custom_description || rule.coupon?.raw_text?.substring(0, 50)) : '';

              return (
                <TactileCard key={rule.id} className="p-3 ring-1 ring-kinetic-orange/30 flex flex-col gap-2 relative">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1 items-center mt-1">
                      <Button variant="ghost" size="sm" className="h-4 w-4 p-0 text-gray-500 hover:text-white" onClick={() => moveUp(index, rule, list)} disabled={index === 0}>
                        <ChevronUp className="w-3 h-3" />
                      </Button>
                      <span className="text-[8px] font-mono text-gray-600">{rule.sort_order || 0}</span>
                      <Button variant="ghost" size="sm" className="h-4 w-4 p-0 text-gray-500 hover:text-white" onClick={() => moveDown(index, rule, list)} disabled={index === list.length - 1}>
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <span className="text-white font-medium text-xs break-words">{label}</span>
                      {desc && <p className="text-[10px] text-gray-400 truncate">{desc}</p>}
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
                      {rule.item_type === 'coupon' && rule.coupon?.is_manual && (
                        <AddManualCouponDialog sourceId={sourceId} routeId={routeId} onSuccess={fetchRules} couponToEdit={{ ...rule.coupon, id: rule.coupon_id }} />
                      )}
                      <Button size="sm" variant="outline" className="h-7 text-[10px] border-kinetic-orange/50 text-kinetic-orange hover:bg-kinetic-orange/10" onClick={() => handleRemoveRule(rule.id)}>
                        Remover do Envio
                      </Button>
                      <div className="flex items-center gap-1 mt-1">
                        {url && (
                          <>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(url)} title="Copiar link">
                              <Copy className="w-3 h-3 text-gray-400 hover:text-white" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => window.open(url, '_blank')} title="Abrir link">
                              <ExternalLink className="w-3 h-3 text-gray-400 hover:text-white" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </TactileCard>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderAvailableList = (items: any[], type: 'coupon' | 'promo_landing') => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2 mt-4">
        <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Disponíveis (Não Enviados)</h5>
        {items.map((item) => {
          const url = type === 'coupon' ? (item.effective_redemption_url || item.redemption_url) : (item.canonical_url || item.raw_url);
          const label = type === 'coupon' ? item.coupon_label : item.title;
          const desc = type === 'coupon' ? (item.custom_description || item.raw_text?.substring(0, 50)) : '';

          return (
            <TactileCard key={item.id} className="p-3 opacity-60 hover:opacity-100 transition-opacity">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <span className="text-gray-300 font-medium text-xs break-words">{label}</span>
                  {desc && <p className="text-[10px] text-gray-500 truncate">{desc}</p>}
                  {type === 'coupon' && item.code && (
                    <div className="mt-1">
                      <span className="bg-deep-void px-1 rounded font-mono text-[9px] text-gray-400 border border-gray-800">
                        Código: {item.code}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <Button size="sm" variant="secondary" className="h-7 text-[10px]" onClick={() => handleAddAvailable(item, type)}>
                    <Plus className="w-3 h-3 mr-1" /> Incluir no Envio
                  </Button>
                  <div className="flex items-center gap-1 mt-1">
                    {url && (
                      <>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(url)} title="Copiar link">
                          <Copy className="w-3 h-3 text-gray-400 hover:text-white" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => window.open(url, '_blank')} title="Abrir link">
                          <ExternalLink className="w-3 h-3 text-gray-400 hover:text-white" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </TactileCard>
          );
        })}
      </div>
    );
  };

  const renderMediaSettings = () => {
    return (
      <TactileCard className="p-4 mb-6 bg-deep-void/40 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-kinetic-orange" />
            Configuração de Mídia da Automação
          </h4>
          <div className="flex items-center gap-2">
            <Checkbox 
              id="use-same-image"
              checked={useSameImage}
              onCheckedChange={async (c) => {
                const val = c as boolean;
                setUseSameImage(val);
                // Salvar imediatamente no template_config para refletir
                await fetch('/api/shopee/automation-coupons/rules', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'update_route',
                    payload: { routeId, updates: { template_config: { ...routeData?.template_config, media: { ...routeData?.template_config?.media, use_same_for_all: val } } } }
                  })
                });
                fetchRules();
              }}
            />
            <label htmlFor="use-same-image" className="text-xs text-gray-300 cursor-pointer">
              Usar a mesma imagem para cupons e páginas promocionais
            </label>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {useSameImage ? (
            <div className="col-span-full">
              <label className="text-xs font-semibold text-gray-400 mb-1 block">Imagem Única (Cupons e Páginas)</label>
              <div className="flex items-center gap-4">
                {globalUrl && (
                  <img src={globalUrl} alt="Global" className="w-16 h-16 object-cover rounded border border-gray-700" />
                )}
                <div className="flex-1">
                  <Input type="file" accept="image/png, image/jpeg, image/webp" className="hidden" ref={globalFileInputRef} onChange={(e) => onFileChange(e, 'global')} />
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => globalFileInputRef.current?.click()} disabled={isUploading['global']}>
                    {isUploading['global'] ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Upload className="w-3 h-3 mr-2" />}
                    Fazer Upload
                  </Button>
                  <p className="text-[10px] text-gray-500 mt-1">Envie do seu computador (PNG, JPG, WEBP. Max 5MB).</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-semibold text-gray-400 mb-1 block">Imagem para Cupons</label>
                <div className="flex items-center gap-4">
                  {couponUrl && (
                    <img src={couponUrl} alt="Coupon" className="w-16 h-16 object-cover rounded border border-gray-700" />
                  )}
                  <div className="flex-1">
                    <Input type="file" accept="image/png, image/jpeg, image/webp" className="hidden" ref={couponFileInputRef} onChange={(e) => onFileChange(e, 'coupon')} />
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => couponFileInputRef.current?.click()} disabled={isUploading['coupon']}>
                      {isUploading['coupon'] ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Upload className="w-3 h-3 mr-2" />}
                      Fazer Upload
                    </Button>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-400 mb-1 block">Imagem para Páginas Promocionais</label>
                <div className="flex items-center gap-4">
                  {pageUrl && (
                    <img src={pageUrl} alt="Page" className="w-16 h-16 object-cover rounded border border-gray-700" />
                  )}
                  <div className="flex-1">
                    <Input type="file" accept="image/png, image/jpeg, image/webp" className="hidden" ref={pageFileInputRef} onChange={(e) => onFileChange(e, 'page')} />
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => pageFileInputRef.current?.click()} disabled={isUploading['page']}>
                      {isUploading['page'] ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Upload className="w-3 h-3 mr-2" />}
                      Fazer Upload
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </TactileCard>
    );
  };

  const selectedCoupons = rules.filter(r => r.item_type === 'coupon');
  const selectedPages = rules.filter(r => r.item_type === 'promo_landing');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Ticket className="w-5 h-5 text-kinetic-orange" />
            Gestão de Cupons e Promoções
          </h3>
          <p className="text-xs text-gray-500">Selecione os itens validados pelo Radar que serão enviados na automação.</p>
        </div>
        <div className="flex gap-2">
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
          <div>
            {renderSelectedList(selectedCoupons, 'Cupons')}
            {renderAvailableList(availableCoupons, 'coupon')}
            {selectedCoupons.length === 0 && availableCoupons.length === 0 && (
              <div className="py-8 text-center bg-anthracite-surface/20 rounded-xl border border-dashed border-gray-800">
                <p className="text-gray-500 text-xs">Nenhum cupom encontrado.</p>
              </div>
            )}
          </div>
          <div>
            {renderSelectedList(selectedPages, 'Páginas Promocionais')}
            {renderAvailableList(availablePages, 'promo_landing')}
            {selectedPages.length === 0 && availablePages.length === 0 && (
              <div className="py-8 text-center bg-anthracite-surface/20 rounded-xl border border-dashed border-gray-800">
                <p className="text-gray-500 text-xs">Nenhuma página promocional encontrada.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
