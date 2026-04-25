
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserSecrets() {
  const userId = '3f3f6acd-c940-476e-8e7e-333643f0e02f';
  const { data, error } = await supabase
    .from('user_marketplace_secrets')
    .select('*, marketplaces(name)')
    .eq('user_id', userId);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Secrets for user:', data);
  }
}

checkUserSecrets();
