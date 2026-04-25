
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listMarketplaces() {
  const { data, error } = await supabase
    .from('marketplaces')
    .select('*');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Marketplaces:', data);
  }
}

listMarketplaces();
