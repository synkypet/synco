// src/services/local/earnings-service.ts
import { EarningsImport, EarningsSummary } from '@/types/earnings';

const STORAGE_KEY = 'synco_local_earnings';

export interface LocalEarningsData {
  summary: EarningsSummary;
  history: EarningsImport[];
}

export const localEarningsService = {
  /**
   * Obtém os dados persistidos no localStorage
   */
  getStoredData(): LocalEarningsData | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Error parsing local earnings:', e);
      return null;
    }
  },

  /**
   * Salva os dados no localStorage
   */
  saveData(data: LocalEarningsData): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  /**
   * Limpa os dados do localStorage
   */
  clearData(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  },

  /**
   * Processa o CSV da Shopee localmente e gera um novo summary
   */
  async processShopeeCSV(fileContent: string): Promise<LocalEarningsData> {
    const lines = fileContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length < 2) throw new Error('Arquivo CSV inválido ou vazio');

    const header = lines[0].split(',').map(h => h.toLowerCase().trim());
    
    // Identificar colunas (mesma lógica do earnings-service original)
    const idxOrderId = header.findIndex(h => h.includes('id') || h.includes('pedido'));
    const idxProductName = header.findIndex(h => h.includes('produto') || h.includes('item') || h.includes('name'));
    const idxOrderAmount = header.findIndex(h => h.includes('valor') || h.includes('preço') || h.includes('price') || h.includes('amount'));
    const idxCommission = header.findIndex(h => h.includes('comissão') || h.includes('fee') || h.includes('earnings'));
    const idxStatus = header.findIndex(h => h.includes('status'));
    const idxTime = header.findIndex(h => h.includes('data') || h.includes('time') || h.includes('hora'));

    const dataRows = lines.slice(1);
    let totalCommissions = 0;
    let totalOrders = 0;
    const items: any[] = [];

    for (const row of dataRows) {
      const values = row.split(',').map(v => v.replace(/^"|"$/g, '').trim());
      const commission = parseFloat(values[idxCommission] || '0') || 0;
      const amount = parseFloat(values[idxOrderAmount] || '0') || 0;
      
      if (!isNaN(commission)) {
        totalCommissions += commission;
        totalOrders += 1;
        
        items.push({
          product_name: values[idxProductName] || 'N/A',
          order_id: values[idxOrderId] || 'N/A',
          order_amount: amount,
          commission_amount: commission,
          status: values[idxStatus] || 'N/A',
          occurred_at: values[idxTime] ? new Date(values[idxTime]).toISOString() : new Date().toISOString()
        });
      }
    }

    // Calcular Aggregations (Monthly)
    const monthlyMap: Record<string, number> = {};
    items.forEach(item => {
      const date = new Date(item.occurred_at);
      const monthKey = date.toLocaleString('pt-BR', { month: 'short' });
      monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + item.commission_amount;
    });

    const monthly_data = Object.entries(monthlyMap).map(([month, ganhos]) => ({
      month,
      ganhos
    }));

    // Calcular Aggregations (Top Products)
    const productMap: Record<string, { orders: number; commission: number }> = {};
    items.forEach(item => {
      const name = item.product_name;
      if (!productMap[name]) productMap[name] = { orders: 0, commission: 0 };
      productMap[name].orders += 1;
      productMap[name].commission += item.commission_amount;
    });

    const top_products = Object.entries(productMap)
      .map(([name, stats]) => ({
        name,
        marketplace: 'Shopee',
        orders: stats.orders,
        commission_total: stats.commission
      }))
      .sort((a, b) => b.commission_total - a.commission_total)
      .slice(0, 5);

    const summary: EarningsSummary = {
      total_commissions: totalCommissions,
      total_orders: totalOrders,
      total_clicks: 0,
      avg_commission: totalOrders > 0 ? totalCommissions / totalOrders : 0,
      monthly_data: monthly_data.length > 0 ? monthly_data : [{ month: 'Jan', ganhos: 0 }],
      top_products
    };

    const newHistoryItem: EarningsImport = {
      id: Math.random().toString(36).substring(7),
      user_id: 'local-user',
      marketplace: 'Shopee',
      period: 'Importação Local',
      status: 'completed',
      products_count: items.length,
      total_orders: totalOrders,
      total_commissions: totalCommissions,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return {
      summary,
      history: [newHistoryItem] // Como decidimos "Substituir", o histórico terá apenas a última
    };
  }
};
