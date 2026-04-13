import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserChannels() {
  const userId = '09309082-83f3-45f9-b5b6-1752f95313ac';
  
  const { data: channels } = await supabase
    .from('channels')
    .select('id, name, config')
    .eq('user_id', userId);
    
  console.log('Channels for user:', channels?.map(c => ({ id: c.id, name: c.name, wasender_id: c.config?.wasender_session_id })));
}

checkUserChannels();
