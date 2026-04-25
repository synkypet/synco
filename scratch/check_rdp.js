
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTable() {
  const { data: cols } = await supabase.rpc('get_table_columns', { table_name: 'radar_discovered_products' });
  if (cols) {
     console.log('Columns for radar_discovered_products:', cols);
  } else {
     // Fallback: try to select one row
     const { data } = await supabase.from('radar_discovered_products').select('*').limit(1);
     if (data && data.length > 0) {
       console.log('Sample row from radar_discovered_products:', Object.keys(data[0]));
     } else if (data) {
       console.log('Table radar_discovered_products exists but is empty.');
       // We can't see columns if it's empty and RPC fails
     } else {
       console.log('Table radar_discovered_products NOT found or error.');
     }
  }
}

checkTable();
