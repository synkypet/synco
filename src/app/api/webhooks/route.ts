// src/app/api/webhooks/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ received: true, timestamp: new Date().toISOString() });
}
