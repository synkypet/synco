-- Migration: 20260512005000_billing_simulation_testers.sql
-- Description: Cria tabela para controle granular de quem pode acessar a simulação de pagamento.

CREATE TABLE IF NOT EXISTS public.billing_simulation_testers (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.billing_simulation_testers ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
-- Usuário comum pode apenas consultar seu próprio registro
DROP POLICY IF EXISTS "Users can view their own simulation access"
ON public.billing_simulation_testers;

CREATE POLICY "Users can view their own simulation access"
ON public.billing_simulation_testers
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Restringir todas as outras operações para usuários comuns
-- Nenhuma política de INSERT, UPDATE ou DELETE é criada para anon/authenticated

-- Garantir permissões de leitura para authenticated
GRANT SELECT ON public.billing_simulation_testers TO authenticated;
GRANT ALL ON public.billing_simulation_testers TO service_role;

-- Criar trigger para updated_at (reutilizando a função genérica set_updated_at se existir, 
-- senão criamos uma específica ou usamos o padrão)
CREATE OR REPLACE FUNCTION public.set_billing_sim_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_billing_sim_updated_at ON public.billing_simulation_testers;
CREATE TRIGGER trg_billing_sim_updated_at
    BEFORE UPDATE ON public.billing_simulation_testers
    FOR EACH ROW
    EXECUTE FUNCTION public.set_billing_sim_updated_at();
