import { ShopeeAdapter } from './src/lib/marketplaces/ShopeeAdapter';
import { processLinks } from './src/lib/linkProcessor';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function runSmokeTest() {
  console.log('--- SYNCO PHASE 1: REMOTE OPERATIONAL VALIDATION ---');
  
  const userId = "3f3f6acd-c940-476e-8e7e-333643f0e02f"; // botzinhoafiliados@gmail.com
  const links = [
    "https://s.shopee.com.br/7Uyf4eE1vC",         // 1. Valid
    "https://s.shopee.com.br/expired-link-test",  // 2. Broken
    "https://shopee.com.br/product/123/456",      // 3. Full
    "https://br.shp.ee/not-supported"             // 4. Legacy (Blocked)
  ];

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, 
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Simulating the enriched connections fetch from remote DB
  const { data: connections } = await supabaseAdmin
    .from('user_marketplaces')
    .select('*, marketplace:marketplaces(name)')
    .eq('user_id', userId);

  const enrichedConnections = connections?.map(c => ({
    ...c,
    marketplace_name: c.marketplace?.name
  })) || [];

  console.log(`\n[DB] Conectado a: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
  console.log(`[USER] Validando para: ${userId}`);

  const snapshots = await processLinks(links, enrichedConnections, 'auto');

  snapshots.forEach((s, i) => {
    console.log(`\n--- SCENARIO ${i + 1}: ${links[i]} ---`);
    console.log(`Classification: ${s.factual.marketplace}`);
    console.log(`Status: ${s.factual.reaffiliation_status}`);
    console.log(`Canonical: ${s.factual.canonical_url}`);
    console.log(`Final Link: ${s.factual.finalLinkToSend}`);
    if (s.factual.reaffiliation_error) {
      console.log(`Error: ${s.factual.reaffiliation_error}`);
    }
    const isApto = s.factual.reaffiliation_status !== 'blocked' && s.factual.reaffiliation_status !== 'failed';
    console.log(`Apto para Dispatch: ${isApto ? '✅ YES' : '❌ NO'}`);
  });

  console.log('\n--- VALIDATION COMPLETE ---');
}

runSmokeTest();
