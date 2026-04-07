'use client';

import React from 'react';
import { Marketplace, UserMarketplaceConnection } from '@/types/marketplace';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { 
  ShoppingBag, 
  Truck, 
  ShoppingCart, 
  Globe, 
  Tag, 
  Save, 
  Store,
  ExternalLink
} from 'lucide-react';

// Mapeamento de ícones do banco de dados para componentes Lucide
const iconMap: Record<string, any> = {
  shopping_bag: ShoppingBag,
  local_shipping: Truck,
  shopping_cart: ShoppingCart,
  global: Globe,
  style: Tag,
  amazon: Store, // Fallback para Amazon
};

interface MarketplaceCardProps {
  marketplace: Marketplace;
  connection?: UserMarketplaceConnection;
  onToggle: (active: boolean) => void;
  onSave: (data: Partial<UserMarketplaceConnection>) => void;
  isSaving?: boolean;
}

export function MarketplaceCard({ 
  marketplace, 
  connection, 
  onToggle, 
  onSave,
  isSaving 
}: MarketplaceCardProps) {
  const Icon = iconMap[marketplace.icon] || Store;
  const [affiliateId, setAffiliateId] = React.useState(connection?.affiliate_id || '');
  const isActive = connection?.is_active || false;

  // Sincroniza o estado local quando a conexão mudar (ex: após salvar)
  React.useEffect(() => {
    setAffiliateId(connection?.affiliate_id || '');
  }, [connection?.affiliate_id]);

  const handleSave = () => {
    onSave({
      affiliate_id: affiliateId,
      is_active: isActive
    });
  };

  const hasChanges = affiliateId !== (connection?.affiliate_id || '');

  return (
    <Card className={`relative overflow-hidden transition-all duration-300 border-2 ${isActive ? 'border-primary/50 bg-primary/[0.02]' : 'border-transparent bg-muted/30 grayscale opacity-70 hover:opacity-100 hover:grayscale-0'}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div 
            className="p-2 rounded-lg shadow-sm" 
            style={{ backgroundColor: `${marketplace.color}15`, color: marketplace.color }}
          >
            <Icon size={24} />
          </div>
          <div>
            <CardTitle className="text-lg font-bold">{marketplace.name}</CardTitle>
            <CardDescription className="text-xs line-clamp-1">{marketplace.description}</CardDescription>
          </div>
        </div>
        <Switch 
          checked={isActive} 
          onCheckedChange={onToggle}
          className="data-[state=checked]:bg-primary"
        />
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {isActive ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor={`affiliate-${marketplace.id}`} className="text-xs font-semibold">ID de Afiliado</Label>
                {hasChanges && <span className="text-[10px] text-orange-500 font-medium">Alterado</span>}
              </div>
              <div className="flex gap-2">
                <Input 
                  id={`affiliate-${marketplace.id}`}
                  placeholder="Seu ID ou Username"
                  value={affiliateId}
                  onChange={(e) => setAffiliateId(e.target.value)}
                  className="h-9 text-sm"
                />
                <Button 
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges}
                  className="h-9 px-3"
                >
                  <Save size={16} className={isSaving ? 'animate-spin' : ''} />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/20 px-2 py-0">
                Ativo
              </Badge>
              <Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground hover:text-primary gap-1">
                Ver Guia <ExternalLink size={10} />
              </Button>
            </div>
          </div>
        ) : (
          <div className="h-[96px] flex flex-col items-center justify-center border-2 border-dashed rounded-lg bg-background/50 gap-2">
            <p className="text-[11px] text-muted-foreground font-medium">Ative para configurar</p>
            <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => onToggle(true)}>
              Ativar Agora
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
