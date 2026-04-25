
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function audit() {
  const sourceId = '9d9a2948-d47d-4bb3-aa4b-1dfc9d0b05b9';
  
  console.log('--- SOURCE STATE ---');
  const { data: source, error: sError } = await supabase
    .from('automation_sources')
    .select('*')
    .eq('id', sourceId)
    .single();
  
  if (sError) console.error(sError);
  else console.log(JSON.stringify(source, null, 2));

  console.log('\n--- PENDING LINKS ---');
  const { count: pendingCount, error: pError } = await supabase
    .from('radar_discovered_products')
    .select('*', { count: 'exact', head: true })
    .eq('source_id', sourceId)
    .eq('status', 'pending');
  
  if (pError) console.error(pError);
  else console.log('Pending Count:', pendingCount);

  console.log('\n--- RECENT LINKS (LAST 50) ---');
  const { data: links, error: lError } = await supabase
    .from('radar_discovered_products')
    .select('product_id, status, discovered_at')
    .eq('source_id', sourceId)
    .order('discovered_at', { ascending: false })
    .limit(50);
  
  if (lError) console.error(lError);
  else console.table(links);
}

audit();
