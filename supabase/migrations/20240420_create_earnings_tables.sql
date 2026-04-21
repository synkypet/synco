-- 1. Tabela de Lotes de Importação
CREATE TABLE IF NOT EXISTS import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  marketplace TEXT NOT NULL DEFAULT 'Shopee',
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_rows INTEGER DEFAULT 0,
  inserted_count INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  error_summary TEXT, 
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_import_batches_user ON import_batches(user_id);

-- 2. Tabela de Pedidos Shopee (Ganhos Reais)
CREATE TABLE IF NOT EXISTS shopee_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL,
  
  -- Identificadores (Regra de Unicidade Multinível)
  external_id TEXT NOT NULL, -- source_item_id ou fingerprint
  source_item_id TEXT,
  source_row_fingerprint TEXT NOT NULL,
  
  -- Dados do Pedido
  order_id TEXT NOT NULL,
  product_id TEXT,
  product_name TEXT,
  order_time TIMESTAMPTZ NOT NULL,
  order_status TEXT NOT NULL,
  
  -- Financeiro
  checkout_amount NUMERIC(12,2) DEFAULT 0,
  estimated_commission NUMERIC(12,2) DEFAULT 0,
  actual_commission NUMERIC(12,2) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  sub_id TEXT, 
  
  -- Auditoria e Metadados
  raw_row_json JSONB NOT NULL,
  marketplace TEXT NOT NULL DEFAULT 'Shopee',
  imported_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Trava de Integridade Multinível
  CONSTRAINT unique_user_external_order UNIQUE(user_id, external_id)
);

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_shopee_orders_user_time ON shopee_orders(user_id, order_time DESC);
CREATE INDEX IF NOT EXISTS idx_shopee_orders_status ON shopee_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_shopee_orders_sub_id ON shopee_orders(sub_id);
