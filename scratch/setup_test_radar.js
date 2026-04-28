const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function setupTestData() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const userId = '59cd0337-2f39-43ce-a596-cd068a1df7f6';
  const groupId = 'c5e9caec-3e17-4ec8-a831-5a9be8ce1da5';
  const sourceName = 'Teste Radar (Antigravity)';
  
  console.log('Setting up automation source for Radar Test...');
  
  // 1. Check if source exists
  let { data: source } = await supabase.from('automation_sources').select('*').eq('name', sourceName).maybeSingle();
  
  if (!source) {
    console.log('Source does not exist, creating...');
    const { data: neu, error } = await supabase.from('automation_sources').insert({
      name: sourceName,
      source_type: 'radar_offers',
      user_id: userId,
      config: { searchTerm: 'teclado mecanico' },
      is_active: true
    }).select().single();
    if (error) { console.error('Error creating source:', error); return; }
    source = neu;
  } else {
    console.log('Source already exists:', source.id, 'Updating config...');
    await supabase.from('automation_sources').update({ config: { searchTerm: 'teclado mecanico' } }).eq('id', source.id);
  }
  
  // 2. Check if route exists
  let { data: route } = await supabase.from('automation_routes').select('*').eq('source_id', source.id).eq('target_id', groupId).maybeSingle();
  
  if (!route) {
    console.log('Route does not exist, creating...');
    const { data: neu, error } = await supabase.from('automation_routes').insert({
      source_id: source.id,
      target_type: 'group',
      target_id: groupId,
      is_active: true,
      filters: { min_price: 10, min_commission_rate: 1 },
      template_config: { custom_header: '🔥 OFERTA RADAR TESTE 🔥' }
    }).select().single();
    if (error) { console.error('Error creating route:', error); return; }
    route = neu;
  } else {
    console.log('Route already exists:', route.id);
  }
  
  console.log('Setup finished successfully.');
}
setupTestData();
