const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const userId = '59cd0337-2f39-43ce-a596-cd068a1df7f6';

async function checkDb() {
  const { data: internal } = await supabase.from('internal_licenses').select('*').eq('user_id', userId);
  const { data: sub } = await supabase.from('subscriptions').select('*').eq('user_id', userId);
  
  console.log('INTERNAL:', JSON.stringify(internal));
  console.log('SUBSCRIPTION:', JSON.stringify(sub));
}

checkDb();
