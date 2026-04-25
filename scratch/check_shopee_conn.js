
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkShopeeConn() {
  const { data, error } = await supabase
    .from('user_marketplaces')
    .select('*')
    .eq('user_id', '3f3f6acd-c940-476e-8e7e-333643f0e02f')
    .eq('marketplace_id', '5f051275-f36b-48a0-a526-ae1c8d0fc6ac')
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Shopee Connection:', data);
  }
}

checkShopeeConn();
