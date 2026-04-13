import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserMismatch() {
  const channelId = '7a7da5a9-2ce6-4e01-acc7-c994dbc4b113';
  
  const { data: channel } = await supabase
    .from('channels')
    .select('user_id')
    .eq('id', channelId)
    .single();
    
  console.log('Channel User ID:', channel?.user_id);
  
  const { data: groups } = await supabase
    .from('groups')
    .select('user_id')
    .eq('channel_id', channelId)
    .limit(1);
    
  console.log('Sample Group User ID:', groups?.[0]?.user_id);
  
  const { data: mismatch } = await supabase
    .from('groups')
    .select('id')
    .eq('channel_id', channelId)
    .neq('user_id', channel?.user_id);
    
  console.log('Number of groups with mismatched User ID:', mismatch?.length || 0);
}

checkUserMismatch();
