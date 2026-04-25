
import { radarDiscoveryService } from '../src/services/radar-discovery-service';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  // Use a specific source ID if possible, otherwise let it find all
  const sourceId = '7a5ce649-6407-46a1-987d-121dc940d761';
  
  console.log('--- STARTING DIAGNOSTIC CYCLE ---');
  const result = await radarDiscoveryService.executeDiscovery(supabase, { 
    sourceId, 
    force: true 
  });
  
  console.log('--- CYCLE FINISHED ---');
  console.log('Result:', result);
}

test().catch(console.error);
