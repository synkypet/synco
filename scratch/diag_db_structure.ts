import { createAdminClient } from '../src/lib/supabase/admin';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function verify() {
  const supabase = createAdminClient();
  
  // 1. Pegar um grupo real
  const { data: group } = await supabase.from('groups').select('id, channel_id, channels(config, type)').limit(1).single();
  
  if (!group) {
    console.error('Nenhum grupo encontrado para teste.');
    return;
  }

  console.log('--- ESTRUTURA RESTRITA ---');
  console.log('Group ID:', group.id);
  console.log('Channels relation type:', Array.isArray(group.channels) ? 'ARRAY' : 'OBJECT');
  
  const channelData = Array.isArray(group.channels) ? group.channels[0] : group.channels;
  console.log('Channel Config Present:', !!channelData?.config);
}

verify();
