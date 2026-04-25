const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listTables() {
  const { data, error } = await supabase.rpc('get_tables'); // Se o RPC existir
  if (error) {
    // Tenta via query direta
    const { data: tables, error: queryErr } = await supabase.from('information_schema.tables').select('table_name').eq('table_schema', 'public');
    if (queryErr) {
        console.error('Erro ao listar tabelas:', queryErr);
    } else {
        console.log('TABELAS:', tables.map(t => t.table_name).join(', '));
    }
  }
}

listTables();
