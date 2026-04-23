'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { Product } from '@/types/product';

// ─── Types ────────────────────────────────────────────────────────────────────

// Reusing the Product type from domain
export interface SelectedProduct {
  id: string;
  name: string;
  original_url: string;
  marketplace: string;
  image_url?: string;
  current_price?: number;
  commission_value?: number;
  status?: string;
  updated_at?: string;
}

interface SelectedProductsContextValue {
  selectedProducts: SelectedProduct[];
  addProduct: (product: Product) => void;
  removeProduct: (productId: string) => void;
  toggleProduct: (product: Product) => void;
  isSelected: (productId: string) => boolean;
  clearProducts: () => void;
  count: number;
  eligibleCount: number;
  reviewCount: number;
  deadCount: number;
  hasIssues: boolean;
  isHydrated: boolean;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const SelectedProductsContext = createContext<SelectedProductsContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * SelectedProductsProvider
 *
 * Migrado de: scr/lib/selectedProductsContext.jsx
 * Adicionado: tipagem TypeScript, toggleProduct, isSelected
 */
export function SelectedProductsProvider({ children }: { children: ReactNode }) {
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Inicialização segura no Client-Side (evita Hydration Mismatch)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('synco_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedProducts(parsed);
        }
      }
    } catch (err) {
      console.error('[TRACE] SelectedProducts: failed to parse localStorage', err);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Sincroniza com localStorage sempre que mudar, APÓS estar hidratado
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('synco_cart', JSON.stringify(selectedProducts));
    }
  }, [selectedProducts, isHydrated]);

  const addProduct = useCallback((product: Product) => {
    setSelectedProducts((prev) => {
      if (prev.some((p) => p.id === product.id)) return prev;
      const lightProduct: SelectedProduct = {
        id: product.id,
        name: product.name,
        original_url: product.original_url,
        marketplace: product.marketplace,
        image_url: product.image_url,
        current_price: product.current_price,
        commission_value: product.commission_value,
        status: product.status,
        updated_at: product.updated_at
      };
      return [...prev, lightProduct];
    });
  }, []);

  const removeProduct = useCallback((productId: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p.id !== productId));
  }, []);

  const toggleProduct = useCallback((product: Product) => {
    setSelectedProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      if (exists) return prev.filter((p) => p.id !== product.id);
      
      const lightProduct: SelectedProduct = {
        id: product.id,
        name: product.name,
        original_url: product.original_url,
        marketplace: product.marketplace,
        image_url: product.image_url,
        current_price: product.current_price,
        commission_value: product.commission_value,
        status: product.status,
        updated_at: product.updated_at
      };
      return [...prev, lightProduct];
    });
  }, []);

  const isSelected = useCallback(
    (productId: string) => selectedProducts.some((p) => p.id === productId),
    [selectedProducts]
  );

  const clearProducts = useCallback(() => {
    setSelectedProducts([]);
  }, []);

  const eligibleCount = selectedProducts.filter(p => p.status === 'eligible').length;
  const reviewCount = selectedProducts.filter(p => p.status === 'review_needed' || p.status === 'audit_failed').length;
  const deadCount = selectedProducts.filter(p => p.status === 'dead').length;
  const hasIssues = reviewCount > 0 || deadCount > 0;

  return (
    <SelectedProductsContext.Provider
      value={{
        selectedProducts,
        addProduct,
        removeProduct,
        toggleProduct,
        isSelected,
        clearProducts,
        count: selectedProducts.length,
        eligibleCount,
        reviewCount,
        deadCount,
        hasIssues,
        isHydrated,
      }}
    >
      {children}
    </SelectedProductsContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSelectedProducts(): SelectedProductsContextValue {
  const context = useContext(SelectedProductsContext);
  if (!context) {
    throw new Error('useSelectedProducts deve ser usado dentro de <SelectedProductsProvider>');
  }
  return context;
}
