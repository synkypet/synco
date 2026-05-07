import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireOperationalAccess } from '@/lib/access/require-operational-access';

export async function GET(request: Request) {
  try {
    const gate = await requireOperationalAccess();
    if (!gate.ok) return gate.response;

    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get('phoneNumber');
    const excludeId = searchParams.get('excludeId'); // Para não validar contra o próprio canal em edição

    if (!phoneNumber) {
      return NextResponse.json({ exists: false });
    }

    const supabase = createClient();
    
    let query = supabase
      .from('channels')
      .select('id', { count: 'exact', head: true })
      .filter('config->phoneNumber', 'eq', phoneNumber);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { count, error } = await query;

    if (error) {
       console.error('[CHECK-DUPLICATE] Error:', error);
       return NextResponse.json({ exists: false, error: error.message });
    }

    return NextResponse.json({ exists: (count || 0) > 0 });
  } catch (err) {
    return NextResponse.json({ exists: false }, { status: 500 });
  }
}
