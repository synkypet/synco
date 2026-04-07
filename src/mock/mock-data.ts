import { 
    Product, 
    Group, 
    Channel, 
    DestinationList, 
    Marketplace, 
    Campaign,
    EarningsImport,
    EarningsSummary,
    WeeklyData,
    HourlyData,
    OperationalHistoryItem
} from '@/types';

// Mock data for SYNCO - Migrado do botBase

export const PRODUCT_IMAGES = [
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop',
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop',
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=300&h=300&fit=crop',
    'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=300&h=300&fit=crop',
    'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=300&h=300&fit=crop',
    'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=300&h=300&fit=crop',
    'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=300&h=300&fit=crop',
    'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=300&h=300&fit=crop',
];

export const MOCK_PRODUCTS: Product[] = [
    { id: '1', name: "Fone Bluetooth TWS Pro Max", store_name: "TechStore Oficial", original_price: 189.90, current_price: 49.90, discount_percent: 74, commission_percent: 12, commission_value: 5.99, coupon: "TECH10", rating: 4.7, sales_count: 15420, opportunity_score: 95, category: "eletronicos", free_shipping: true, official_store: true, tags: ["Oferta Forte", "Menor Preço", "Tendência"], status: "active", is_favorite: true, already_sent: false, marketplace: "Shopee", image_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=300&fit=crop", original_url: "https://shopee.com.br/produto/1" },
    { id: '2', name: "Kit 3 Panos Microfibra Premium", store_name: "Casa & Cia", original_price: 59.90, current_price: 19.90, discount_percent: 67, commission_percent: 15, commission_value: 2.99, coupon: "CASA5", rating: 4.5, sales_count: 8320, opportunity_score: 88, category: "casa_cozinha", free_shipping: true, official_store: false, tags: ["Cupom Bom", "Oferta Forte"], status: "active", is_favorite: false, already_sent: true, marketplace: "Shopee", image_url: "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=300&h=300&fit=crop", original_url: "https://shopee.com.br/produto/2" },
    { id: '3', name: "Relógio Digital LED Esportivo", store_name: "SportWatch", original_price: 129.90, current_price: 34.90, discount_percent: 73, commission_percent: 10, commission_value: 3.49, coupon: "", rating: 4.3, sales_count: 22150, opportunity_score: 82, category: "esportes", free_shipping: true, official_store: true, tags: ["Tendência", "Menor Preço"], status: "active", is_favorite: false, already_sent: false, marketplace: "Shopee", image_url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop", original_url: "https://shopee.com.br/produto/3" },
    { id: '4', name: "Organizador Maquiagem Acrílico 360°", store_name: "Beleza Express", original_price: 149.90, current_price: 59.90, discount_percent: 60, commission_percent: 18, commission_value: 10.78, coupon: "BELEZA15", rating: 4.8, sales_count: 5890, opportunity_score: 91, category: "beleza", free_shipping: false, official_store: false, tags: ["Oferta Forte", "Cupom Bom"], status: "active", is_favorite: true, already_sent: false, marketplace: "Shopee", image_url: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=300&h=300&fit=crop", original_url: "https://shopee.com.br/produto/4" },
    { id: '5', name: "Óculos de Sol Polarizado UV400", store_name: "Fashion World", original_price: 89.90, current_price: 29.90, discount_percent: 67, commission_percent: 14, commission_value: 4.19, coupon: "FASHION20", rating: 4.4, sales_count: 31200, opportunity_score: 86, category: "moda", free_shipping: true, official_store: true, tags: ["Menor Preço", "Tendência"], status: "active", is_favorite: false, already_sent: true, marketplace: "Mercado Livre", image_url: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=300&h=300&fit=crop", original_url: "https://mercadolivre.com.br/produto/5" },
    { id: '6', name: "Câmera Wi-Fi 360° Segurança", store_name: "SmartHome BR", original_price: 299.90, current_price: 89.90, discount_percent: 70, commission_percent: 8, commission_value: 7.19, coupon: "", rating: 4.6, sales_count: 9870, opportunity_score: 79, category: "eletronicos", free_shipping: true, official_store: true, tags: ["Oferta Forte"], status: "active", is_favorite: false, already_sent: false, marketplace: "Amazon", image_url: "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=300&h=300&fit=crop", original_url: "https://amazon.com.br/produto/6" },
    { id: '7', name: "Tênis Casual Leve Respirável", store_name: "Calçados Prime", original_price: 199.90, current_price: 69.90, discount_percent: 65, commission_percent: 11, commission_value: 7.69, coupon: "TENIS30", rating: 4.2, sales_count: 18450, opportunity_score: 84, category: "moda", free_shipping: true, official_store: false, tags: ["Tendência", "Cupom Bom"], status: "active", is_favorite: true, already_sent: false, marketplace: "Shopee", image_url: "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=300&h=300&fit=crop", original_url: "https://shopee.com.br/produto/7" },
    { id: '8', name: "Headphone Gamer RGB Surround 7.1", store_name: "GamersHub", original_price: 249.90, current_price: 79.90, discount_percent: 68, commission_percent: 9, commission_value: 7.19, coupon: "GAMER15", rating: 4.5, sales_count: 12300, opportunity_score: 87, category: "eletronicos", free_shipping: true, official_store: true, tags: ["Oferta Forte", "Cupom Bom", "Tendência"], status: "active", is_favorite: false, already_sent: false, marketplace: "Mercado Livre", image_url: "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=300&h=300&fit=crop", original_url: "https://mercadolivre.com.br/produto/8" },
    { id: '9', name: "Kit Pincéis Maquiagem 15 peças", store_name: "Beauty Queen", original_price: 79.90, current_price: 24.90, discount_percent: 69, commission_percent: 20, commission_value: 4.98, coupon: "BEAUTY10", rating: 4.6, sales_count: 7650, opportunity_score: 92, category: "beleza", free_shipping: true, official_store: false, tags: ["Oferta Forte", "Menor Preço", "Cupom Bom"], status: "active", is_favorite: false, already_sent: false, marketplace: "Magalu", image_url: "https://images.unsplash.com/photo-1560343090-f0409e92791a?w=300&h=300&fit=crop", original_url: "https://magalu.com.br/produto/9" },
    { id: '10', name: "Luminária LED Mesa Toque Dimmer", store_name: "LuzDesign", original_price: 119.90, current_price: 44.90, discount_percent: 63, commission_percent: 13, commission_value: 5.84, coupon: "", rating: 4.4, sales_count: 6230, opportunity_score: 76, category: "casa_cozinha", free_shipping: false, official_store: false, tags: ["Tendência"], status: "active", is_favorite: false, already_sent: true, marketplace: "Shopee", image_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop", original_url: "https://shopee.com.br/produto/10" },
];

export const MOCK_CHANNELS: Channel[] = [
    { id: 'c1', user_id: 'user_123', name: "WhatsApp Principal", type: "whatsapp", status: "active", is_active: true, groups_count: 12, contacts_count: 3450, messages_sent: 15230, description: "Canal principal de divulgação via WhatsApp" },
    { id: 'c2', user_id: 'user_123', name: "Telegram Ofertas", type: "telegram", status: "active", is_active: true, groups_count: 5, contacts_count: 8920, messages_sent: 22100, description: "Canal de ofertas no Telegram" },
    { id: 'c3', user_id: 'user_123', name: "Instagram @achadinhos", type: "instagram", status: "active", is_active: true, groups_count: 0, contacts_count: 12500, messages_sent: 890, description: "Perfil do Instagram" },
];

export const MOCK_GROUPS: Group[] = [
    { id: 'g1', user_id: 'user_123', channel_id: 'c1', name: "Achadinhos do Dia 🔥", channel_name: "WhatsApp Principal", members_count: 2560, status: "active", tags: ["ofertas", "diário"], is_source: false, is_destination: true, sends_received: 142, is_monitored: true, is_active: true },
    { id: 'g2', user_id: 'user_123', channel_id: 'c1', name: "Eletrônicos em Promo", channel_name: "WhatsApp Principal", members_count: 1890, status: "active", tags: ["eletrônicos", "tech"], is_source: false, is_destination: true, sends_received: 98, is_monitored: false, is_active: true },
    { id: 'g6', user_id: 'user_123', channel_id: 'c2', name: "Ofertas Flash ⚡", channel_name: "Telegram Ofertas", members_count: 4520, status: "active", tags: ["flash", "urgente"], is_source: true, is_destination: true, sends_received: 320, is_monitored: true, is_active: true },
];

export const MOCK_DESTINATION_LISTS: DestinationList[] = [
    { id: 'dl1', user_id: 'user_123', name: "Promoções Gerais", description: "Grupos principais de divulgação geral", group_ids: ['g1', 'g2', 'g6'], color: 'orange', icon: '🔥', status: 'active', is_active: true },
    { id: 'dl2', user_id: 'user_123', name: "Eletrônicos", description: "Grupos especializados em tech e eletrônicos", group_ids: ['g2', 'g6'], color: 'blue', icon: '💻', status: 'active', is_active: true },
];

export const MOCK_MARKETPLACES: Marketplace[] = [
    { id: 'shopee', name: 'Shopee', icon: '🛍️', configured: true, affiliate_id: 'user_shopee_123', last_validated: '2026-04-03T08:00:00', color: 'orange', description: 'Programa de afiliados Shopee' },
    { id: 'amazon', name: 'Amazon', icon: '📦', configured: true, affiliate_id: 'user-amazon-br-20', last_validated: '2026-04-02T14:00:00', color: 'blue', description: 'Amazon Associates BR' },
];

export const MOCK_CAMPAIGNS: Campaign[] = [
    { id: 'cp1', user_id: 'user_123', name: "Mega Ofertas Abril", segment_name: "Super Ofertas Geral", template_name: "Oferta Irresistível", status: "pending", products_count: 15, sent_count: 12, pending_count: 3, failed_count: 0, scheduled_at: "2026-04-03T10:00:00" },
    { id: 'cp2', user_id: 'user_123', name: "Flash Friday", segment_name: "Flash Sales", template_name: "Flash Sale ⚡", status: "completed", products_count: 8, sent_count: 8, pending_count: 0, failed_count: 0, completed_at: "2026-04-02T18:00:00" },
];

export const MOCK_AUTOMATIONS = [
    { id: 'auto1', name: "Auto-Post Shopee", source_group: "Ofertas Flash ⚡", destination_list: "Promoções Gerais", status: "active", last_run: "2026-04-04T09:30:00", converted_count: 45, type: 'forward' },
    { id: 'auto2', name: "Monitor Amazon Tech", source_group: "Amazon Deals", destination_list: "Eletrônicos", status: "paused", last_run: "2026-04-03T15:20:00", converted_count: 12, type: 'filter' },
];

export const MOCK_MONITORINGS = [
    { id: 'mon1', group_name: "Ofertas Flash ⚡", channel: "Telegram", status: "monitoring", speed: "fast", caught_count: 128, description: "Monitoramento em tempo real de ofertas relâmpago" },
    { id: 'mon2', group_name: "Amazon Deals", channel: "WhatsApp", status: "error", caught_count: 0, description: "Monitoramento de promoções Amazon" },
];

export const MOCK_EARNINGS: EarningsImport[] = [
    { id: 'e1', user_id: 'user_123', marketplace: 'Shopee', period: 'Abril 2026', products_count: 45, total_orders: 128, total_commissions: 1450.50, status: 'completed', created_at: '2026-04-04T10:00:00', updated_at: '2026-04-04T10:00:00' },
    { id: 'e2', user_id: 'user_123', marketplace: 'Amazon', period: 'Abril 2026', products_count: 22, total_orders: 85, total_commissions: 890.20, status: 'completed', created_at: '2026-04-03T14:30:00', updated_at: '2026-04-03T14:30:00' },
    { id: 'e3', user_id: 'user_123', marketplace: 'Mercado Livre', period: 'Abril 2026', products_count: 15, total_orders: 42, total_commissions: 560.00, status: 'completed', created_at: '2026-04-02T16:15:00', updated_at: '2026-04-02T16:15:00' },
];

export const MOCK_TOP_PRODUCTS: EarningsSummary['top_products'] = [
    { name: "Fone Bluetooth TWS Pro Max", marketplace: "Shopee", orders: 34, commission_total: 203.66 },
    { name: "Relógio Digital LED Esportivo", marketplace: "Shopee", orders: 28, commission_total: 97.72 },
    { name: "Óculos de Sol Polarizado UV400", marketplace: "Mercado Livre", orders: 15, commission_total: 62.85 },
];

export const MOCK_WEEKLY_DATA: WeeklyData[] = [
    { name: 'Seg', enviados: 450, pendentes: 10, falhas: 2 },
    { name: 'Ter', enviados: 520, pendentes: 15, falhas: 1 },
    { name: 'Qua', enviados: 480, pendentes: 5, falhas: 3 },
    { name: 'Qui', enviados: 610, pendentes: 20, falhas: 0 },
    { name: 'Sex', enviados: 580, pendentes: 12, falhas: 2 },
    { name: 'Sáb', enviados: 320, pendentes: 8, falhas: 1 },
    { name: 'Dom', enviados: 250, pendentes: 5, falhas: 0 },
];

export const MOCK_MONTHLY_TREND: EarningsSummary['monthly_data'] = [
    { month: 'Nov', ganhos: 1200 },
    { month: 'Dez', ganhos: 1850 },
    { month: 'Jan', ganhos: 1420 },
    { month: 'Fev', ganhos: 1580 },
    { month: 'Mar', ganhos: 1750 },
    { month: 'Abr', ganhos: 1920 },
];

export const MOCK_HOURLY_DATA: HourlyData[] = [
    { hour: '00h', enviados: 120 },
    { hour: '04h', enviados: 45 },
    { hour: '08h', enviados: 310 },
    { hour: '12h', enviados: 580 },
    { hour: '16h', enviados: 640 },
    { hour: '20h', enviados: 820 },
];

export const MOCK_OPERATIONAL_HISTORY: OperationalHistoryItem[] = [
    { date: '2026-04-04 14:30', event: 'Campanha "Mega Ofertas" enviada', type: 'campaign', envios: 450, alcance: 2800 },
    { date: '2026-04-04 10:15', event: 'Automação "Auto-Post" executada', type: 'automation', envios: 12, alcance: 850 },
    { date: '2026-04-03 21:00', event: 'Monitoramento detectou 5 ofertas', type: 'monitoring', envios: 5, alcance: 1200 },
];
