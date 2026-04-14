import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Carregar .env do projeto
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('--- CAMPAIGN_ITEMS ---');
  const { data: itemData, error: itemError } = await supabase
    .from('campaign_items')
    .select('*')
    .limit(1);
  
  if (itemError) {
    console.error('Error fetching campaign_items:', itemError.message);
  } else if (itemData && itemData.length > 0) {
    console.log('Columns found:', Object.keys(itemData[0]));
  } else {
    // Se a tabela estiver vazia, tentamos pegar as colunas via rpc ou information_schema se permitido
    console.log('Tabela vazia ou não encontrada.');
  }

  console.log('\n--- SEND_JOBS ---');
  const { data: jobData, error: jobError } = await supabase
    .from('send_jobs')
    .select('*')
    .limit(1);

  if (jobError) {
    console.error('Error fetching send_jobs:', jobError.message);
  } else if (jobData && jobData.length > 0) {
    console.log('Columns found:', Object.keys(jobData[0]));
  } else {
    console.log('Tabela vazia ou não encontrada.');
  }
}

checkSchema();
