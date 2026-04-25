
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSecrets() {
  const { data, error } = await supabase
    .from('user_marketplace_secrets')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching secrets:', error);
  } else {
    console.log('Secrets found:', data);
  }
}

checkSecrets();
