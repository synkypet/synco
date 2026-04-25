
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const { radarDiscoveryService } = require('./src/services/radar-discovery-service');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debugDiscovery() {
  console.log('--- DEBUG DISCOVERY PIPELINE ---');

  // 1. Get an active radar source
  const { data: sources } = await supabase
    .from('automation_sources')
    .select('*')
    .eq('source_type', 'radar_offers')
    .eq('is_active', true)
    .limit(1);

  if (!sources || sources.length === 0) {
    console.log('No active radar sources found to test.');
    return;
  }

  const source = sources[0];
  console.log(`Testing with source: ${source.name} (${source.id})`);
  console.log('Config:', JSON.stringify(source.config, null, 2));

  // 2. Run discovery and capture more logs
  // We'll wrap the service call or look at its logs. 
  // Since I can't easily modify the service and run it here without transpilation issues (TS),
  // I will write a standalone JS version of the core discovery logic for debugging.

  try {
    const result = await radarDiscoveryService.executeDiscovery(supabase, { sourceId: source.id, force: true });
    console.log('Discovery result:', result);
  } catch (err) {
    console.error('Discovery failed with error:', err);
  }
}

debugDiscovery();
