'use client';

import React, { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { SelectedProductsProvider } from '@/contexts/SelectedProductsContext';

// ─── Query Client ─────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,   // 5 minutos
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// ─── Providers ────────────────────────────────────────────────────────────────

/**
 * Providers globais do SYNCO.
 *
 * Hierarquia:
 * AuthProvider
 *   └── QueryClientProvider
 *         └── SelectedProductsProvider
 *               └── {children}
 *
 * Origem: migrado de scr/App.jsx (botBase)
 * Removido: AuthProvider do Base44, Toaster do base44
 * Adicionado: Sonner Toaster para notificações
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <SelectedProductsProvider>
          {children}
        </SelectedProductsProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}
