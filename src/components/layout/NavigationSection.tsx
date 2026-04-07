'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { type NavSection } from '@/lib/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavigationSectionProps {
  section: NavSection;
  collapsed: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * NavigationSection
 *
 * Componente auxiliar da Sidebar.
 * Renderiza uma seção de navegação com label e lista de itens.
 * Extraído para permitir reuso em diferentes contextos de navegação
 * (mobile drawer, sidebar desktop, etc.).
 */
export default function NavigationSection({ section, collapsed }: NavigationSectionProps) {
  const pathname = usePathname();

  return (
    <div>
      {!collapsed && (
        <div className="pt-3 pb-1 px-2">
          <p className="text-[10px] font-semibold text-sidebar-foreground/30 uppercase tracking-wider">
            {section.label}
          </p>
        </div>
      )}
      {collapsed && <div className="pt-2" />}

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
              'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group relative',
              isActive
                ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20'
                : item.highlight
                  ? 'text-sidebar-primary hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
            )}
          >
            <Icon className={cn('w-4 h-4 flex-shrink-0', isActive && 'drop-shadow-sm')} />
            {!collapsed && (
              <span className="text-xs font-medium whitespace-nowrap">{item.label}</span>
            )}
            {collapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-foreground text-background text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                {item.label}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
