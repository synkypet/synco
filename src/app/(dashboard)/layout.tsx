import React from 'react';
import AppLayout from '@/components/layout/AppLayout';

/**
 * Dashboard Group Layout
 *
 * Aplica o AppLayout (sidebar + topbar) para todas as rotas
 * dentro do grupo (dashboard).
 *
 * Next.js App Router: o grupo (dashboard) não aparece na URL,
 * apenas organiza o layout compartilhado.
 */
export default function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
