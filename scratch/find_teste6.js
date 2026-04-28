const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function findTeste6() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: channels, error } = await supabase.from('channels').select('id, name');
  if (error) {
    console.error('Error fetching channels:', error);
    return;
  }

  console.log('--- Channels List ---');
  channels.forEach(c => console.log(`- ${c.name} (${c.id})`));
  
  const target = channels.find(c => c.name.toLowerCase().includes('teste6'));
  if (target) {
    console.log('\n--- TARGET FOUND ---');
    console.log(JSON.stringify(target, null, 2));
  } else {
    console.log('\nTarget "teste6" not found in channels list.');
  }
}
findTeste6();
