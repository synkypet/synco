
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function audit404() {
  const channelId = '20d6fcde-5ea8-40e0-8e1e-1f6a6564c2b1';
  console.log(`Auditing Channel: ${channelId}`);

  const { data: channel, error } = await supabase
    .from('channels')
    .select('id, user_id, config, status, name')
    .eq('id', channelId)
    .single();

  if (error) {
    console.error('Error fetching channel:', error.message);
  } else {
    console.log('Channel found:', JSON.stringify(channel, null, 2));
  }
}

audit404();
