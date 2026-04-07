/**
 * FAKE AUTH — Fase 1 / Desenvolvimento
 *
 * Substitui temporariamente o AuthContext do Base44.
 * Simula um usuário sempre autenticado para permitir o desenvolvimento
 * dos componentes de UI sem dependência de backend.
 *
 * SERÁ SUBSTITUÍDO na Fase 6 por autenticação real via Supabase.
 */

export interface FakeUser {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: 'admin' | 'user';
  created_at: string;
}

export const FAKE_USER: FakeUser = {
  id: 'dev-user-001',
  email: 'dev@synco.app',
  full_name: 'Dev User',
  avatar_url: null,
  role: 'admin',
  created_at: new Date().toISOString(),
};

/**
 * Retorna o usuário fake de desenvolvimento.
 * No futuro, esta função será substituída por supabase.auth.getUser()
 */
export async function getFakeUser(): Promise<FakeUser> {
  // Simula latência mínima de rede
  await new Promise((resolve) => setTimeout(resolve, 50));
  return FAKE_USER;
}

/**
 * Simula logout — na Fase 6 será supabase.auth.signOut()
 */
export async function fakeLogout(): Promise<void> {
  // Em dev, apenas redireciona para login visualmente
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}
