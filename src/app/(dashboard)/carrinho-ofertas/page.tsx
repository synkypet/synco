// src/app/(dashboard)/carrinho-ofertas/page.tsx
'use client';

import React from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Trash2, 
  ArrowRight, 
  ShoppingBag, 
  ChevronLeft,
  Store,
  Tag,
  AlertCircle
} from 'lucide-react';
import { useSelectedProducts } from '@/contexts/SelectedProductsContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function CarrinhoOfertasPage() {
  const { selectedProducts, removeProduct, clearProducts, count } = useSelectedProducts();
  const router = useRouter();

  const handleClearCart = () => {
    clearProducts();
    toast.success('Carrinho limpo com sucesso!');
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-2 text-muted-foreground mb-[-1rem]">
        <Link href="/radar-ofertas" className="flex items-center hover:text-primary transition-colors text-xs font-bold uppercase tracking-tight">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Voltar ao Radar
        </Link>
      </div>

      <PageHeader
        title="Meu Carrinho"
        description={`Você selecionou ${count} ${count === 1 ? 'produto' : 'produtos'} para envio.`}
        actions={
          count > 0 && (
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClearCart}
                className="text-red-500 hover:text-red-600 hover:bg-red-500/10 font-bold uppercase text-[10px]"
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              Limpar Tudo
            </Button>
          )
        }
      />

      {count === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 gap-6 border-dashed border-2 bg-muted/20">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <ShoppingBag className="w-10 h-10 text-muted-foreground opacity-40" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold uppercase tracking-tight">Seu carrinho está vazio</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto text-balance">
              Navegue pelo Radar de Ofertas e selecione os produtos que deseja enviar para seus canais.
            </p>
          </div>
          <Link href="/radar-ofertas">
            <Button className="bg-primary text-white font-bold uppercase tracking-tight h-10 px-8 shadow-lg shadow-primary/20">
              Ir para o Radar
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Listagem de Produtos */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col gap-3">
              {selectedProducts.map((product) => (
                <Card key={product.id} className="p-3 group hover:shadow-md transition-all border-border/50">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <img 
                        src={product.image_url || 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=100&h=100&fit=crop'} 
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-bold uppercase">
                          <Store className="w-2.5 h-2.5 mr-1" />
                          {product.marketplace}
                        </Badge>
                        <button 
                          onClick={() => removeProduct(product.id)}
                          className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <h4 className="text-sm font-bold truncate mb-1">{product.name}</h4>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-primary">R$ {(product.current_price || 0).toFixed(2)}</span>
                        <div className="flex items-center text-[10px] font-bold text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">
                           Comissão: R$ {(product.commission_value || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Resumo e Ação de Envio */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="p-6 border-primary/20 bg-primary/[0.02] shadow-sm sticky top-24">
              <h3 className="text-sm font-black uppercase tracking-widest text-primary mb-6">Resumo do Envio</h3>
              
              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Produtos Selecionados:</span>
                  <span className="font-bold">{count}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Valor Total Estimado:</span>
                  <span className="font-bold">R$ {selectedProducts.reduce((acc, p) => acc + (p.current_price || 0), 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Comissão Total:</span>
                  <span className="font-bold text-green-600">R$ {selectedProducts.reduce((acc, p) => acc + (p.commission_value || 0), 0).toFixed(2)}</span>
                </div>
                <div className="pt-4 border-t border-dashed">
                  <div className="flex items-center gap-2 p-3 bg-yellow-500/10 rounded-lg text-yellow-700 border border-yellow-500/20">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <p className="text-[10px] font-bold leading-tight uppercase">
                      O carrinho é salvo localmente no seu navegador.
                    </p>
                  </div>
                </div>
              </div>

              <Button 
                className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-primary/20"
                onClick={() => router.push('/envio-rapido')}
              >
                Prosseguir para Envio
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <p className="text-[10px] text-center text-muted-foreground mt-4 font-medium italic">
                Próximo passo: Configurar canais e texto
              </p>
            </Card>

            <div className="p-4 rounded-xl border border-dashed border-border bg-muted/10">
               <div className="flex items-center gap-2 mb-2">
                 <Tag className="w-3.5 h-3.5 text-primary" />
                 <span className="text-[10px] font-black uppercase tracking-tight">Personalização</span>
               </div>
               <p className="text-[10px] text-muted-foreground leading-relaxed">
                 Você poderá personalizar o texto de cada produto no próximo passo usando IA ou templates salvos.
               </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
