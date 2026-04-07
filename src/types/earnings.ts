// src/types/earnings.ts

export type ImportStatus = 'processing' | 'completed' | 'failed';

export interface EarningsImport {
  id: string;
  user_id: string;
  marketplace: string;
  period: string | null;
  status: ImportStatus;
  products_count: number;
  total_orders: number;
  total_commissions: number;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EarningsImportItem {
  id: string;
  import_id: string;
  user_id: string;
  product_name: string | null;
  order_id: string | null;
  order_amount: number | null;
  commission_amount: number | null;
  status: string | null;
  occurred_at: string | null;
  created_at: string;
}

export interface EarningsSummary {
  total_commissions: number;
  total_orders: number;
  total_clicks: number; // For now 0/null as per rules
  avg_commission: number;
  monthly_data: { month: string; ganhos: number }[];
  top_products: { name: string; marketplace: string; orders: number; commission_total: number }[];
}
