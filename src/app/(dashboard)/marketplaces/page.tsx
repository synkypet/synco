import React from 'react';
import { MarketplaceGrid } from '@/components/marketplaces/MarketplaceGrid';
import { ShoppingBag } from 'lucide-react';

export const metadata = {
  title: 'Marketplaces | SYNCO',
  description: 'Configure seus IDs de afiliado e ative os marketplaces que você utiliza.',
};

export default function MarketplacesPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-primary">
          <ShoppingBag size={24} className="animate-pulse" />
          <h1 className="text-3xl font-bold tracking-tight">Marketplaces</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl">
          Conecte suas contas de afiliado para que o SYNCO consiga gerar seus links automaticamente. 
          Ative os marketplaces desejados e insira seu ID de rastreio.
        </p>
      </div>

      <div className="border-t pt-8">
        <MarketplaceGrid />
      </div>
    </div>
  );
}
