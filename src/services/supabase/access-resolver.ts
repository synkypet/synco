import { AccessResolution, Quotas, Features } from '@/types/billing';

export const UNLIMITED_QUOTAS: Quotas = {
  max_channels: 999,
  max_groups_sync: 9999,
  max_sends_per_month: 9999999,
};

export const FULL_FEATURES: Features = {
  radar_access: true,
  api_access: true,
  advanced_reports: true,
};

export const BLOCKED_QUOTAS: Quotas = {
  max_channels: 0,
  max_groups_sync: 0,
  max_sends_per_month: 0,
};

export const NO_FEATURES: Features = {
  radar_access: false,
  api_access: false,
  advanced_reports: false,
};

/**
 * Lógica Core de Resolução de Acesso.
 * Recebe o cliente Supabase explicitamente para evitar vazamento de next/headers em client-side.
 */
export async function resolveUserAccessCore(userId: string, supabase: any): Promise<AccessResolution> {
  // 1. Bypass Interno
  const { data: internal } = await supabase
    .from('internal_licenses')
    .select('role')
    .eq('user_id', userId)
    .single();

  if (internal) {
    return {
      status: 'internal_license',
      isOperative: true,
      quotas: UNLIMITED_QUOTAS,
      features: FULL_FEATURES,
    };
  }

  // 2. Busca Assinatura
  const { data: sub, error } = await supabase
    .from('subscriptions')
    .select(`
      *,
      plan:plans(*)
    `)
    .eq('user_id', userId)
    .single();

  if (!sub || error) {
    return {
      status: 'no_subscription',
      isOperative: false,
      quotas: BLOCKED_QUOTAS,
      features: NO_FEATURES,
    };
  }

  const planLimits = sub.plan?.limits || { quotas: BLOCKED_QUOTAS, features: NO_FEATURES };

  // 3. Resolução de Status
  switch (sub.status) {
    case 'active':
      return {
        status: 'active_subscription',
        isOperative: true,
        planId: sub.plan_id,
        planName: sub.plan?.name,
        quotas: planLimits.quotas,
        features: planLimits.features,
      };

    case 'trialing':
      return {
        status: 'trial',
        isOperative: true,
        planId: sub.plan_id,
        planName: sub.plan?.name,
        quotas: planLimits.quotas,
        features: planLimits.features,
      };

    case 'past_due':
      return {
        status: 'past_due_restricted',
        isOperative: false, 
        planId: sub.plan_id,
        planName: sub.plan?.name,
        quotas: planLimits.quotas,
        features: planLimits.features,
      };

    default:
      return {
        status: 'expired_blocked',
        isOperative: false,
        planId: sub.plan_id,
        planName: sub.plan?.name,
        quotas: BLOCKED_QUOTAS,
        features: NO_FEATURES,
      };
  }
}
