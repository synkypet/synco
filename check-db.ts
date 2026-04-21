import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching a single item to check current shape...');
  const { data: item } = await supabase.from('campaign_items').select('*').limit(1);
  console.log('Current item:', Object.keys(item?.[0] || {}));

  console.log('Attempting to add columns using direct update bypass...');
  // Since we don't have RPC, we'll wait for the user to apply this via the Supabase Dashboard,
  // or we can test if the PostgREST API auto-accepts new JSON keys if we don't strictly type them,
  // BUT the user asked for schema migration. It's best we supply the SQL.
}

run();
