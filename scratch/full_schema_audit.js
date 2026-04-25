const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function auditFullSchema() {
  const tables = ['products', 'automation_sources', 'automation_routes', 'automation_dedupe', 'send_jobs'];
  
  console.log('--- Database Schema Audit ---');
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(`Error auditing ${table}:`, error.message);
      continue;
    }
    console.log(`\nTable: ${table}`);
    console.log(`Columns: ${Object.keys(data[0] || {}).join(', ')}`);
    
    // Check for unique constraints or identifiable keys (like original_url or item_id)
    if (table === 'products') {
      console.log('Sample product record:', JSON.stringify(data[0], null, 2));
    }
  }
}

auditFullSchema();
