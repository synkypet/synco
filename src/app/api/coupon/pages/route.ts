
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();
    
    const { data: pages, error } = await supabase
      .from('shopee_coupon_pages')
      .select('*')
      .eq('is_active', true)
      .not('short_link', 'is', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[API-COUPON-PAGES] Error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(pages);
  } catch (err: any) {
    console.error('[API-COUPON-PAGES] Fatal Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
