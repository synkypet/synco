
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findShopeeUser() {
  const { data: connections, error } = await supabase
    .from('user_marketplaces')
    .select('user_id, marketplace_id, marketplaces(name)')
    .eq('is_active', true);

  if (error) {
    console.error('Error:', error);
    return;
  }

  const shopeeConn = connections.find(c => c.marketplaces.name === 'Shopee');
  if (shopeeConn) {
    console.log('SHOPEE_USER_ID:' + shopeeConn.user_id);
    console.log('MARKETPLACE_ID:' + shopeeConn.marketplace_id);
  } else {
    console.log('NO_SHOPEE_USER');
  }
}

findShopeeUser();
