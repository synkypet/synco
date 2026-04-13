
import { WasenderClient } from './src/lib/wasender/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testStatus() {
  const sessionId = '77472';
  console.log(`Testing Status for Session: ${sessionId}`);

  try {
    const status = await WasenderClient.getStatus(sessionId);
    console.log('Status Response:', JSON.stringify(status, null, 2));
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

testStatus();
