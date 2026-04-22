import { createClient } from '@/lib/supabase/server';
import { AccessResolution } from '@/types/billing';
import { resolveUserAccessCore } from './access-resolver';

/**
 * Resolvedor de Acesso para Ambiente Servidor (APIs, Server Actions)
 * Centraliza a resolução usando o cliente de servidor do Supabase.
 */
export async function resolveUserAccess(userId: string, client?: any): Promise<AccessResolution> {
  const supabase = client || createClient();
  return resolveUserAccessCore(userId, supabase);
}

/**
 * Helper rápido para verificar apenas se o usuário pode operar (Server-only)
 */
export async function isUserOperative(userId: string): Promise<boolean> {
  const resolution = await resolveUserAccess(userId);
  return resolution.isOperative;
}
