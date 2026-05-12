import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Verificar Kill Switch Global
    const isGlobalEnabled = process.env.BILLING_SIMULATION_ENABLED === 'true';
    if (!isGlobalEnabled) {
      return NextResponse.json({ enabled: false });
    }

    // 2. Verificar autenticação
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ enabled: false }, { status: 401 });
    }

    // 3. Verificar permissão granular do usuário
    const adminSupabase = createAdminClient();
    const { data: tester, error: testerError } = await adminSupabase
      .from('billing_simulation_testers')
      .select('is_enabled')
      .eq('user_id', user.id)
      .single();

    if (testerError || !tester || !tester.is_enabled) {
      return NextResponse.json({ enabled: false });
    }

    // Se chegou aqui, está autorizado
    return NextResponse.json({ enabled: true });

  } catch (error: any) {
    console.error("[SIMULATION_ACCESS] Error:", error.message);
    return NextResponse.json({ enabled: false }, { status: 500 });
  }
}
