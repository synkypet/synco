
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function audit() {
  const sourceId = '9d9a2948-d47d-4bb3-aa4b-1dfc9d0b05b9';
  const { data: source } = await supabase.from('automation_sources').select('*').eq('id', sourceId).single();
  console.log('NEEDS_RESTOCK:', source.needs_restock);
  console.log('DISCOVERY_PAGE:', source.discovery_page);
  console.log('LAST_RESTOCK_AT:', source.last_restock_at);
  console.log('RESTOCK_ATTEMPTS:', source.restock_attempts);
}

audit();
