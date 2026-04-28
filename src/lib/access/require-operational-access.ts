import { NextResponse } from 'next/server';
import { resolveUserAccessCore } from '@/services/supabase/access-resolver';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { AccessResolution } from '@/types/billing';

export type AccessGateResult =
  | {
      ok: true;
      user: any;
      access: AccessResolution;
    }
  | {
      ok: false;
      response: NextResponse;
      reason:
        | "unauthenticated"
        | "subscription_required"
        | "subscription_inactive"
        | "plan_limit_exceeded"
        | "operational_access_blocked";
    };

/**
 * Gate central para verificar autenticação e acesso operacional.
 * Fonte ÚNICA de verdade do usuário: o cookie/jwt via Supabase Auth.
 */
export async function requireOperationalAccess(): Promise<AccessGateResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      reason: 'unauthenticated',
      response: NextResponse.json(
        { error: 'unauthenticated', message: 'Você precisa estar logado.' }, 
        { status: 401 }
      )
    };
  }

  // Consultas administrativas usam Service Role para bypass de RLS
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, 
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const access = await resolveUserAccessCore(user.id, adminClient);

  if (!access.isOperative) {
    let reason = 'operational_access_blocked';
    let statusCode = 403;
    let message = 'Seu acesso operacional está bloqueado no momento.';

    if (access.status === 'no_subscription') {
      reason = 'subscription_required';
      statusCode = 402;
      message = 'Você precisa de uma assinatura ativa para usar este recurso.';
    } else if (['expired_blocked', 'canceled', 'expired', 'incomplete', 'none'].includes(access.status!)) {
      reason = 'subscription_inactive';
      statusCode = 402;
      message = 'Sua assinatura está inativa. Atualize seu plano para continuar usando o SYNCO.';
    }

    return {
      ok: false,
      reason: reason as any,
      response: NextResponse.json(
        { error: reason, message, status: access.status }, 
        { status: statusCode }
      )
    };
  }

  return { ok: true, user, access };
}

/**
 * Checa o consumo real de Envios (Send Jobs criados neste mês). (OPÇÃO A)
 */
export async function requireSendLimit(userId: string, requestedSends: number, quotas: any): Promise<NextResponse | null> {
  if (quotas.max_sends_per_month >= 999999) return null;

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, 
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { count } = await adminClient
    .from('send_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfMonth);
  
  const usedThisMonth = count || 0;

  if (usedThisMonth + requestedSends > quotas.max_sends_per_month) {
    const msg = 'Você atingiu o limite de envios do seu plano atual (' + quotas.max_sends_per_month + '/mês). Consumo atual: ' + usedThisMonth + '.';
    return NextResponse.json({
      error: 'plan_limit_exceeded',
      message: msg
    }, { status: 422 });
  }

  return null;
}

/**
 * Checa o limite estrito de conexões ativas na conta.
 */
export async function requireChannelLimit(userId: string, quotas: any): Promise<NextResponse | null> {
  if (quotas.max_channels >= 9999) return null;

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, 
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { count } = await adminClient
    .from('channels')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const usedChannels = count || 0;

  if (usedChannels + 1 > quotas.max_channels) {
    const msg = 'Você atingiu o limite de canais do seu plano atual (' + quotas.max_channels + ').';
    return NextResponse.json({
      error: 'plan_limit_exceeded',
      message: msg
    }, { status: 422 });
  }

  return null;
}

/**
 * Avalia importações/sync de Grupos.
 */
export async function requireGroupLimit(userId: string, incomingGroupsCount: number, quotas: any): Promise<NextResponse | null> {
  if (quotas.max_groups_sync >= 9999) return null;

  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, 
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { count } = await adminClient
    .from('groups')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const usedGroups = count || 0;

  if (usedGroups + incomingGroupsCount > quotas.max_groups_sync) {
    const msg = 'Limite de Grupos excedido (' + quotas.max_groups_sync + '). Com esta ação você ficaria com ' + (usedGroups + incomingGroupsCount) + ' grupos.';
    return NextResponse.json({
      error: 'plan_limit_exceeded',
      message: msg
    }, { status: 422 });
  }

  return null;
}
