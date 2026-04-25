
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'automation_logs' });
  if (error) {
    // If RPC doesn't exist, try query
    const { data: cols } = await supabase.from('automation_logs').select('*').limit(1);
    console.log('Columns:', Object.keys(cols[0] || {}));
    return;
  }
  console.log(data);
}

check();
