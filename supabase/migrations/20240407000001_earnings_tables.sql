-- supabase/migrations/20240407000001_earnings_tables.sql

-- Tabela de Importações de Ganhos
CREATE TABLE IF NOT EXISTS public.earnings_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    marketplace TEXT NOT NULL,
    period TEXT,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    products_count INTEGER DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_commissions NUMERIC(15, 2) DEFAULT 0.00,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de Itens/Linhas da Importação
CREATE TABLE IF NOT EXISTS public.earnings_import_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID NOT NULL REFERENCES public.earnings_imports(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_name TEXT,
    order_id TEXT,
    order_amount NUMERIC(15, 2),
    commission_amount NUMERIC(15, 2),
    status TEXT, -- e.g., 'completed', 'cancelled'
    occurred_at TIMESTAMPTZ, -- Data da venda no relatório
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.earnings_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings_import_items ENABLE ROW LEVEL SECURITY;

-- Políticas para earnings_imports
CREATE POLICY "Users can view their own earnings imports"
    ON public.earnings_imports FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own earnings imports"
    ON public.earnings_imports FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own earnings imports"
    ON public.earnings_imports FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own earnings imports"
    ON public.earnings_imports FOR DELETE
    USING (auth.uid() = user_id);

-- Políticas para earnings_import_items
CREATE POLICY "Users can view their own earnings import items"
    ON public.earnings_import_items FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own earnings import items"
    ON public.earnings_import_items FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_earnings_imports_user_id ON public.earnings_imports(user_id);
CREATE INDEX IF NOT EXISTS idx_earnings_import_items_import_id ON public.earnings_import_items(import_id);
CREATE INDEX IF NOT EXISTS idx_earnings_import_items_user_id ON public.earnings_import_items(user_id);
CREATE INDEX IF NOT EXISTS idx_earnings_import_items_occurred_at ON public.earnings_import_items(occurred_at);

-- Trigger para updated_at em earnings_imports
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_earnings_imports_updated_at
    BEFORE UPDATE ON public.earnings_imports
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
