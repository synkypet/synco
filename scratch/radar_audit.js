
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runAudit() {
  console.log('--- RADAR SYSTEM AUDIT ---');

  // 1. Check automation_sources
  console.log('\nChecking automation_sources...');
  const { data: sources, error: sourcesError } = await supabase
    .from('automation_sources')
    .select('*');

  if (sourcesError) {
    console.error('Error fetching automation_sources:', sourcesError);
  } else {
    console.log(`Total sources: ${sources.length}`);
    const activeRadar = sources.filter(s => s.source_type === 'radar_offers' && s.is_active);
    console.log(`Active Radar sources (radar_offers): ${activeRadar.length}`);
    
    if (activeRadar.length > 0) {
      console.log('Sample Radar Source Config:', JSON.stringify(activeRadar[0].config, null, 2));
      console.log('Sample Radar Source Columns:', Object.keys(activeRadar[0]).join(', '));
    }
  }

  // 2. Check radar_discovered_products
  console.log('\nChecking radar_discovered_products...');
  const { count: productsCount, error: productsError } = await supabase
    .from('radar_discovered_products')
    .select('*', { count: 'exact', head: true });

  if (productsError) {
    console.log('Table radar_discovered_products NOT FOUND or error:', productsError.message);
  } else {
    console.log(`Total products in radar_discovered_products: ${productsCount}`);
  }

  // 3. Check radar_keyword_cache (mentioned by user)
  console.log('\nChecking radar_keyword_cache...');
  const { error: cacheError } = await supabase
    .from('radar_keyword_cache')
    .select('*', { count: 'exact', head: true });

  if (cacheError) {
    console.log('Table radar_keyword_cache NOT FOUND or error:', cacheError.message);
  } else {
    console.log('Table radar_keyword_cache EXISTS.');
  }

  // 4. Test RPC claim_source_lock
  console.log('\nTesting RPC claim_source_lock...');
  // We try a fake call to see if it exists (it might fail due to params but we want to see if it's 404)
  const { data: rpcData, error: rpcError } = await supabase.rpc('claim_source_lock', {
    p_source_id: '00000000-0000-0000-0000-000000000000',
    p_worker_id: 'audit-test',
    p_timeout_mins: 1
  });

  if (rpcError) {
    if (rpcError.code === 'PGRST202') {
      console.log('❌ RPC claim_source_lock NOT FOUND (404)');
    } else {
      console.log(`✅ RPC claim_source_lock EXISTS (Returned error ${rpcError.code}: ${rpcError.message})`);
    }
  } else {
    console.log('✅ RPC claim_source_lock EXISTS and returned:', rpcData);
  }

  // 5. Check products table
  console.log('\nChecking products table schema...');
  const { data: productSample, error: productError } = await supabase
    .from('products')
    .select('*')
    .limit(1);

  if (productError) {
    console.log('Table products NOT FOUND or error:', productError.message);
  } else {
    console.log('Table products EXISTS.');
    if (productSample.length > 0) {
       console.log('Product columns:', Object.keys(productSample[0]).join(', '));
    }
  }
}

runAudit();
