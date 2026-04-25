const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addColumn() {
  console.log('Attempting to add metadata column...');
  // Tenta via RPC comum em setups Supabase (se o usuário criou)
  const { error } = await supabase.rpc('exec_sql', { 
    sql: 'ALTER TABLE products ADD COLUMN IF NOT EXISTS metadata JSONB;' 
  });

  if (error) {
    console.warn('RPC exec_sql not found or failed. Using category fallback strategy.', error.message);
  } else {
    console.log('Column metadata added successfully.');
  }
}

addColumn();
