import { createClient } from '@supabase/supabase-js';

// Cria um cliente de administração (bypassa RLS)
// IMPORTANTE: Deve ser usado apenas em server-side e endpoints protegidos (como cron verbs).
export function createAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase Environment Variables for Admin Client');
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
