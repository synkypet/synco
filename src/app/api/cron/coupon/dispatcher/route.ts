
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { shopeeCouponDispatcher } from '@/services/shopee-coupon-dispatcher';
import { capturedCouponDispatcher } from '@/services/captured-coupon-dispatcher';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const rid = Math.random().toString(36).substring(7);
  console.log(`[CRON-COUPON] [${rid}] Iniciando trigger...`);

  try {
    // 1. Auth check
    const { searchParams } = new URL(request.url);
    const cronSecret = request.headers.get('x-cron-secret') || searchParams.get('key');
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && cronSecret !== expectedSecret) {
      console.warn(`[CRON-COUPON] [${rid}] Unauthorized attempt.`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // 2. Dispatch - Fluxo A: Campanhas Oficiais
    console.log(`[CRON-COUPON] [${rid}] Processando campanhas oficiais Shopee...`);
    const officialResult = await shopeeCouponDispatcher.executeDispatch(supabase, { requestId: rid });

    // 3. Dispatch - Fluxo B: Cupons Capturados
    console.log(`[CRON-COUPON] [${rid}] Processando cupons capturados Shopee...`);
    const capturedResult = await capturedCouponDispatcher.executeDispatch(supabase, { requestId: rid });

    return NextResponse.json({
      status: 'SUCCESS',
      official: {
        sourcesProcessed: officialResult.sourcesProcessed,
        jobsCreated: officialResult.jobsCreated
      },
      captured: {
        sourcesProcessed: capturedResult.sourcesProcessed,
        couponsProcessed: capturedResult.couponsProcessed,
        jobsCreated: capturedResult.jobsCreated,
        skippedByDedupe: capturedResult.skippedByDedupe
      },
      totalJobsCreated: officialResult.jobsCreated + capturedResult.jobsCreated,
      requestId: rid,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error(`[CRON-COUPON] [${rid}] FATAL ERROR:`, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
