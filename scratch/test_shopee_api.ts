
import { ShopeeAdapter } from '../src/lib/marketplaces/ShopeeAdapter';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const adapter = new ShopeeAdapter();
  
  const userId = '59cd0337-2f39-43ce-a596-cd068a1df7f6';
  
  // Get connection
  const { data: connections } = await supabase.from('user_marketplaces').select('*, marketplaces(name)').eq('user_id', userId).eq('is_active', true);
  const shopeeConn = connections?.find(c => (c.marketplaces as any).name === 'Shopee');

  if (!shopeeConn) {
    console.log('No Shopee connection found for user');
    return;
  }

  // Decrypt secret (we need the logic from marketplaceService)
  // For simplicity, I'll just check if we can get the enriched one via the service
  const { marketplaceService } = require('../src/services/supabase/marketplace-service');
  const enriched = await marketplaceService.getEnrichedConnections(userId, supabase);
  const conn = enriched.find(c => c.marketplace_name === 'Shopee');

  console.log('Testing Shopee Discovery for "air fryer"...');
  const products = await adapter.discoverProducts({
    keyword: 'air fryer',
    limit: 10,
    connection: conn
  });

  console.log(`Found ${products.length} products.`);
  products.forEach((p, i) => {
    console.log(`${i+1}: ${p.name} | Price: ${p.currentPrice} | Comm: ${p.commissionRate}`);
  });
}

test();
