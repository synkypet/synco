import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function audit() {
  const channelId = '7a7da5a9-2ce6-4e01-acc7-c994dbc4b113';
  
  const { data: groups, error } = await supabase
    .from('groups')
    .select('name, remote_id, is_active, updated_at')
    .eq('channel_id', channelId)
    .order('name');
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Group Names in DB:');
  groups.forEach((g, i) => {
    console.log(`${i+1}. [${g.remote_id}] ${g.name} (Active: ${g.is_active}, Updated: ${g.updated_at})`);
  });
}

audit();
