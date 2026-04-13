import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function audit() {
  const channelId = '7a7da5a9-2ce6-4e01-acc7-c994dbc4b113';
  
  console.log('--- AUDIT GROUPS FOR CHANNEL', channelId, '---');
  
  const { data: groups, error } = await supabase
    .from('groups')
    .select('*')
    .eq('channel_id', channelId);
    
  if (error) {
    console.error('Error fetching groups:', error);
    return;
  }
  
  console.log('Total groups in DB for channel:', groups.length);
  
  const activeGroups = groups.filter(g => g.is_active);
  const inactiveGroups = groups.filter(g => !g.is_active);
  
  console.log('Active groups:', activeGroups.length);
  console.log('Inactive groups:', inactiveGroups.length);
  
  if (inactiveGroups.length > 0) {
    console.log('Sample inactive groups:', inactiveGroups.slice(0, 5).map(g => ({ id: g.id, remote_id: g.remote_id, name: g.name })));
  }

  // Check the most recently updated groups
  const recent = [...groups].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 5);
  console.log('Recently updated groups:', recent.map(g => ({ remote_id: g.remote_id, name: g.name, updated_at: g.updated_at, is_active: g.is_active })));
}

audit();
