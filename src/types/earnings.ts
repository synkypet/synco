// src/types/earnings.ts

export type OrderStatus = 'Pending' | 'Completed' | 'Cancelled' | 'To Pay' | string;

export interface ImportBatch {
  id: string;
  user_id: string;
  filename: string;
  marketplace: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_rows: number;
  inserted_count: number;
  updated_count: number;
  failed_count: number;
  error_summary?: string;
  created_at: string;
}

export interface ShopeeOrder {
  id: string;
  user_id: string;
  batch_id?: string;
  
  // Identificadores (Regra de Unicidade Multinível)
  external_id: string;
  source_item_id?: string;
  source_row_fingerprint: string;
  
  // Dados do Pedido
  order_id: string;
  product_id?: string;
  product_name?: string;
  order_time: string;
  order_status: OrderStatus;
  
  // Financeiro
  checkout_amount: number;
  estimated_commission: number;
  actual_commission: number;
  currency: string;
  sub_id?: string;
  
  // Auditoria
  raw_row_json: any;
  marketplace: string;
  imported_at: string;
  updated_at: string;
}

export interface OperationalStats {
  totalCampaigns: number;
  totalJobs: number;
  recentActivity: any[];
}
