import {
  LayoutDashboard,
  SendHorizonal,
  ShoppingCart,
  Eye,
  Radar,
  Users,
  FileText,
  Megaphone,
  Zap,
  BarChart3,
  Settings,
  Sparkles,
  Store,
  Bot,
  List,
  DollarSign,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  highlight?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

/**
 * Navegação principal do SYNCO em português.
 * Substitui NAV_ITEMS do botBase/scr/components/layout/Sidebar.jsx.
 *
 * Decisões aplicadas:
 * - Rotas em pt-BR
 * - Segmentos removidos da UX (substituídos por Listas de Destino)
 * - MultiplosEnvios e RadarShopee não são rotas independentes
 * - /assistente-ia adicionado
 * - /canais adicionado
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Principal',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Envio',
    items: [
      { path: '/envio-rapido', label: 'Envio Rápido', icon: SendHorizonal, highlight: true },
      { path: '/carrinho-ofertas', label: 'Carrinho de Ofertas', icon: ShoppingCart },
      { path: '/monitoramento', label: 'Monitoramento', icon: Eye },
    ],
  },
  {
    label: 'Descoberta',
    items: [
      { path: '/radar-ofertas', label: 'Radar de Ofertas', icon: Radar },
      { path: '/marketplaces', label: 'Marketplaces', icon: Store },
    ],
  },
  {
    label: 'Organização',
    items: [
      { path: '/grupos', label: 'Grupos', icon: Users },
      { path: '/canais', label: 'Canais', icon: List },
      { path: '/listas-destino', label: 'Listas de Destino', icon: List },
      { path: '/templates', label: 'Templates', icon: FileText },
    ],
  },
  {
    label: 'Operação',
    items: [
      { path: '/campanhas', label: 'Campanhas', icon: Megaphone },
      { path: '/automacoes', label: 'Automações', icon: Zap },
    ],
  },
  {
    label: 'Resultados',
    items: [
      { path: '/ganhos', label: 'Ganhos', icon: DollarSign },
      { path: '/relatorios', label: 'Relatórios', icon: BarChart3 },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { path: '/assistente-ia', label: 'Assistente IA', icon: Bot },
      { path: '/configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
];

/** Lista plana de todos os itens de navegação. */
export const NAV_ITEMS_FLAT: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

/** Ícone do app */
export const APP_ICON = Sparkles;
/** Nome do app na sidebar */
export const APP_NAME = 'SYNCO';
