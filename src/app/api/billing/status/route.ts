import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveUserAccessCore } from '@/services/supabase/access-resolver';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();
    
    // O access resolver já é a fonte da verdade oficial no Synco
    const resolution = await resolveUserAccessCore(user.id, adminSupabase);

    // Ocultar dados sensíveis, retornamos só o necessário para a UI
    return NextResponse.json({
      status: resolution.status,
      isOperative: resolution.isOperative,
      planName: resolution.planName,
      quotas: resolution.quotas,
      features: resolution.features,
    });

  } catch (error: any) {
    console.error("[BILLING_STATUS] Error:", error.message);
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}
