'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, Bell, User, LogOut, ChevronDown, Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopbarProps {
  onMobileMenuToggle: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Topbar
 *
 * Migrado de: scr/components/layout/Topbar.jsx (botBase)
 * Alterações:
 * - Removido: `import { base44 } from '@/api/base44Client'`
 * - Logout agora usa `useAuth().logout()` (fake-auth por enquanto)
 * - Links de settings ajustados para rotas pt-BR (/configuracoes)
 * - Removido import de componentes shadcn não disponíveis ainda (UI será Fase 2)
 *   → versão inline com HTML semântico e classes Tailwind diretas
 */
export default function Topbar({ onMobileMenuToggle }: TopbarProps) {
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário';
  const initials = getInitials(displayName);

  return (
    <header className="h-16 bg-deep-void/70 backdrop-blur-2xl flex items-center justify-between px-4 md:px-6 sticky top-0 z-30 shadow-[0_1px_0_0_rgba(255,255,255,0.05)] glass-edge">
      {/* Left — hamburger + search */}
      <div className="flex items-center gap-6">
        <button
          className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          onClick={onMobileMenuToggle}
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="search"
            placeholder="Buscar produtos, campanhas, templates..."
            className={cn(
              'pl-9 pr-4 py-2 w-[320px] text-sm rounded-lg',
              // Skeuo-pressed: inset shadow simulates cavity in the panel
              'bg-[#0E0E11] shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.02)]',
              'border-none outline-none ring-0 text-white/80',
              'placeholder:text-white/20',
              'focus:ring-1 focus:ring-kinetic-orange/50 transition-all'
            )}
            aria-label="Buscar"
          />
        </div>

        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-emerald-500">Status: Online</span>
          </div>
          <div className="h-4 w-px bg-white/5" />
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/20">
            Região: SA-East-1
          </div>
        </div>
      </div>

      {/* Right — notifications + user */}
      <div className="flex items-center gap-1">

        {/* Notificações */}
        <div className="relative">
          <button
            className="relative p-2 rounded-lg hover:bg-white/5 transition-colors"
            onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }}
            aria-label="Notificações"
            aria-expanded={notifOpen}
          >
            <Bell className="w-5 h-5 text-white/50" />
            {/* Kinetic orange dot — active status indicator */}
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-kinetic-orange rounded-full shadow-glow-orange" />
          </button>

          {notifOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setNotifOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-72 bg-anthracite-surface backdrop-blur-xl rounded-2xl shadow-skeuo-elevated z-50 animate-fade-in overflow-hidden">
                <div className="p-3">
                  <p className="font-semibold text-sm text-white/80">Notificações</p>
                </div>
                {/* Gradient separator — No-Line */}
                <div className="h-px mx-3 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <div>
                  {[
                    { title: 'Automação executada', desc: 'Comissão Alta Automática enviou 10 produtos' },
                    { title: 'Campanha concluída', desc: 'Flash Friday finalizada com sucesso' },
                    { title: 'Novo produto em alta', desc: 'Fone Bluetooth TWS com score 95' },
                  ].map((n) => (
                    <button
                      key={n.title}
                      className="w-full text-left p-3 hover:bg-white/5 transition-colors"
                    >
                      <p className="text-sm font-medium text-white/80">{n.title}</p>
                      <p className="text-xs text-white/30">{n.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
            onClick={() => { setUserMenuOpen(!userMenuOpen); setNotifOpen(false); }}
            aria-expanded={userMenuOpen}
            aria-label="Menu do usuário"
          >
            {/* Avatar with kinetic-orange ring */}
            <div className="w-8 h-8 rounded-full bg-kinetic-orange text-white flex items-center justify-center text-xs font-semibold flex-shrink-0 shadow-glow-orange">
              {initials}
            </div>
            <span className="text-sm font-medium hidden md:inline text-white/70">{displayName}</span>
            <ChevronDown className="w-3 h-3 text-white/30" />
          </button>

          {userMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setUserMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-52 bg-anthracite-surface backdrop-blur-xl rounded-2xl shadow-skeuo-elevated z-50 animate-fade-in overflow-hidden">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-white/80">{displayName}</p>
                  <p className="text-xs text-white/30">{user?.email}</p>
                </div>
                {/* Gradient separator — No-Line */}
                <div className="h-px mx-3 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <div className="py-1">
                  <Link
                    href="/configuracoes?tab=perfil"
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 text-white/60 hover:text-white transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <User className="w-4 h-4" />
                    Meu Perfil
                  </Link>
                  <Link
                    href="/configuracoes?tab=afiliados"
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 text-white/60 hover:text-white transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <span className="w-4 h-4 text-center text-xs">🛍️</span>
                    Programas de Afiliado
                  </Link>
                  <Link
                    href="/configuracoes?tab=organizacao"
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 text-white/60 hover:text-white transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <span className="w-4 h-4 text-center text-xs">🏢</span>
                    Organização
                  </Link>
                  {/* Gradient separator — No-Line */}
                  <div className="my-1 h-px mx-2 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <button
                    onClick={() => { setUserMenuOpen(false); logout(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
