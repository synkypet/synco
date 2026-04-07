'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  NAV_SECTIONS,
  APP_ICON,
  APP_NAME,
} from '@/lib/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Sidebar
 *
 * Migrado de: scr/components/layout/Sidebar.jsx (botBase)
 * Alterações:
 * - `Link` e `useLocation` (react-router-dom) → `Link` e `usePathname` (next/navigation)
 * - NAV_ITEMS flat → NAV_SECTIONS com separadores de seção
 * - Rotas em português (via navigation.ts)
 * - Zero dependências Base44
 */
export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const AppIcon = APP_ICON;

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-300',
        // Glass Panel — No-Line philosophy: depth via shadow, not border
        'bg-deep-void/70 backdrop-blur-3xl',
        'shadow-[8px_0_40px_rgba(0,0,0,0.8)]',
        collapsed ? 'w-[68px]' : 'w-[220px]'
      )}
    >
      {/* Logo */}
      <div className="flex flex-col justify-center px-4 h-16 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-kinetic-orange shadow-glow-orange flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:shadow-glow-orange-intense">
            <AppIcon className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-none">
              <span className="text-white font-black text-lg tracking-tighter font-headline uppercase">
                {APP_NAME}
              </span>
              <span className="text-[10px] text-white/20 font-bold uppercase tracking-[0.2em] mt-0.5">
                Operational Hub
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Gradient separator — No-Line: visual depth via gradient instead of solid border */}
      <div className="h-px mx-4 bg-gradient-to-r from-transparent via-white/10 to-transparent flex-shrink-0" />

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {/* Section label */}
            {!collapsed && (
              <div className="pt-3 pb-1 px-2">
                <p className="text-[10px] font-semibold text-sidebar-foreground/30 uppercase tracking-wider">
                  {section.label}
                </p>
              </div>
            )}
            {collapsed && <div className="pt-2" />}

            {/* Items */}
            {section.items.map((item) => {
              const isActive =
                item.path === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.path);
              const Icon = item.icon;

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative',
                    isActive
                      ? [
                          // Active: skeuo-pressed with orange glow — matches referencia/stitch
                          'bg-kinetic-orange/10 text-kinetic-orange',
                          'shadow-[inset_2px_2px_5px_rgba(0,0,0,0.4),0_0_10px_rgba(255,107,0,0.15)]',
                        ]
                      : item.highlight
                        ? 'text-white/40 hover:bg-white/5 hover:text-kinetic-orange'
                        : 'text-white/40 hover:bg-white/5 hover:text-white/80'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-4 h-4 flex-shrink-0 transition-all duration-200',
                      isActive && 'drop-shadow-[0_0_6px_rgba(255,107,0,0.7)]'
                    )}
                  />
                  {!collapsed && (
                    <span className="text-[11px] font-bold uppercase tracking-wider font-headline whitespace-nowrap">{item.label}</span>
                  )}
                  {/* Tooltip em modo compacto */}
                  {collapsed && (
                    <div className="absolute left-full ml-3 px-3 py-1.5 bg-anthracite-surface text-white text-xs rounded-lg shadow-skeuo-elevated opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                      {item.label}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Gradient separator */}
      <div className="h-px mx-4 bg-gradient-to-r from-transparent via-white/10 to-transparent flex-shrink-0" />

      {/* Toggle */}
      <div className="p-3 flex-shrink-0">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center py-2 rounded-xl text-white/30 hover:text-kinetic-orange hover:bg-kinetic-orange/10 transition-all duration-200"
          aria-label={collapsed ? 'Expandir menu' : 'Colapsar menu'}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
