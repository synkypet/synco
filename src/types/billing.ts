export type AccessStatus = 
  | 'internal_license'       // Bypass Administrativo (Server-side allowlist)
  | 'active_subscription'    // Pagante regular
  | 'trial'                  // Em período de testes ativo
  | 'past_due_restricted'    // Inadimplente (Acesso interface liberado, operação bloqueada)
  | 'expired_blocked'        // Vencido / Cancelado de fato
  | 'no_subscription';       // Não possui contrato

export interface Quotas {
  max_channels: number;
  max_groups_sync: number;
  max_sends_per_month: number;
}

export interface Features {
  radar_access: boolean;
  api_access: boolean;
  advanced_reports: boolean;
}

export interface AccessResolution {
  status: AccessStatus;
  isOperative: boolean; // Flag central: true para operação liberada (envios/criação), false para leitura-apenas (past_due) ou bloqueio.
  planId?: string;
  planName?: string;
  quotas: Quotas;
  features: Features;
}

export interface Plan {
  id: string;
  name: string;
  billing_cycle: 'monthly' | 'yearly';
  limits: {
    quotas: Quotas;
    features: Features;
  };
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string | null;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'incomplete';
  provider: string | null;
  provider_customer_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  plan?: Plan;
}
