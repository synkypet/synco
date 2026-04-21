'use client';

import React, { useState, useEffect, type ReactNode } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import FloatingAIChat from '@/components/shared/FloatingAIChat';
import OnboardingTutorial from '@/components/shared/OnboardingTutorial';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatePresence } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppLayoutProps {
  children: ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AppLayout
 *
 * Migrado de: scr/components/layout/AppLayout.jsx (botBase)
 * Alterações principais:
 * - `<Outlet />` (react-router-dom) → `{children}` (Next.js)
 * - base44.auth.me() removido — auth agora vem do AuthContext via useAuth()
 * - SelectedProductsProvider removido (duplicidade corrigida — agora global em providers.tsx)
 * - FloatingCartBar será adicionado na Fase 2 (quando componentes shared forem migrados)
 */
export default function AppLayout({ children }: AppLayoutProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  // Onboarding desabilitado por enquanto a pedido do usuário
  /*
  useEffect(() => {
    if (!authLoading && user) {
      const isCompleted = user.user_metadata?.onboarding_completed;
      if (isCompleted === undefined || isCompleted === false) {
        const timer = setTimeout(() => setShowTutorial(true), 1200);
        return () => clearTimeout(timer);
      } else {
        setShowTutorial(false);
      }
    }
  }, [user, authLoading]);
  */

  return (
    <div className="min-h-screen bg-deep-void">
        {/* Tutorial Layer desabilitada */}
        {/*
        <AnimatePresence>
          {showTutorial && user && (
            <OnboardingTutorial 
              isOpen={showTutorial} 
              onClose={() => setShowTutorial(false)} 
              userId={user.id}
            />
          )}
        </AnimatePresence>
        */}

        {/* Mobile overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <div className={`${mobileMenuOpen ? 'block' : 'hidden'} lg:block`}>
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((c) => !c)}
          />
        </div>

        {/* Main content */}
        <div
          className={`transition-all duration-300 ${
            sidebarCollapsed ? 'lg:ml-[68px]' : 'lg:ml-[220px]'
          }`}
        >
          <Topbar onMobileMenuToggle={() => setMobileMenuOpen((o) => !o)} />

          <main className="min-h-[calc(100vh-64px)]">
            {children}
          </main>
        </div>

        {/* FloatingCartBar — será habilitado na Fase 2 */}
        {/* <FloatingCartBar /> */}

        {/* Floating AI Chat (SYNKY) */}
        <FloatingAIChat />
      </div>
  );
}
