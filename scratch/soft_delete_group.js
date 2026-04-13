
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const groupId = 'b2ebab34-2ffb-45d0-9c05-316752e2e398';
  
  console.log(`Soft deleting group: ${groupId}`);
  
  const { data, error } = await supabase
    .from('groups')
    .update({ is_active: false })
    .eq('id', groupId)
    .select();
    
  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
  
  console.log('Success:', data);
  process.exit(0);
}

run();
