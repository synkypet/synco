
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function crossAudit() {
  const channelIds = [
    '7662e975-6ad2-436e-bb9c-debdfbafe211',
    'f3662b5c-fd0c-403e-a2f2-e754a116e514',
    '20d6fcde-5ea8-40e0-8e1e-1f6a6564c2b1'
  ];

  console.log(`Cross-Auditing Channels...`);

  for (const id of channelIds) {
    const { data: channel } = await supabase
      .from('channels')
      .select('id, user_id, config, name')
      .eq('id', id)
      .single();
    
    if (channel) {
      console.log(`Channel: ${channel.name} (${id}) -> Owner: ${channel.user_id}`);
    } else {
      console.log(`Channel: ${id} -> NOT FOUND`);
    }
  }
}

crossAudit();
