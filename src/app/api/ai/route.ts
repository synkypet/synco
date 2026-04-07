// src/app/api/ai/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ message: 'AI endpoint placeholder' });
}
