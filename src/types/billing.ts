export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | "canceled"
  | "expired"
  | "incomplete"
  | "none";

// Mantém suporte pra compatibilidade antiga mas alinha o status interno correto
export type AccessStatus = SubscriptionStatus | 'internal_license' | 'past_due_restricted' | 'expired_blocked' | 'no_subscription';

export function normalizeMercadoPagoSubscriptionStatus(mpStatus: string): SubscriptionStatus {
  switch (mpStatus?.toLowerCase()) {
    case "authorized":
      return "active";
    case "paused":
      return "past_due";
    case "cancelled":
      return "canceled";
    case "finished":
      return "expired";
    case "pending":
      return "incomplete";
    default:
      return "incomplete";
  }
}

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
  status: SubscriptionStatus;
  provider: string | null;
  provider_customer_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  plan?: Plan;
  provider_subscription_id?: string | null;
  provider_payment_id?: string | null;
  provider_status?: string | null;
  canceled_at?: string | null;
  grace_period_end?: string | null;
  metadata?: any;
}
