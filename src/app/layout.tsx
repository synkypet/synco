import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// ─── Font ─────────────────────────────────────────────────────────────────────

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
});

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: {
    default: 'SYNCO — Plataforma de Afiliados',
    template: '%s | SYNCO',
  },
  description:
    'Gerencie seus grupos, envie ofertas e monitore seus resultados de afiliado em um só lugar.',
  keywords: ['afiliados', 'ofertas', 'whatsapp', 'telegram', 'shopee', 'amazon', 'comissão'],
  authors: [{ name: 'SYNCO' }],
  robots: { index: false, follow: false }, // Não indexar em fase de desenvolvimento
};

// ─── Root Layout ──────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-inter antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
