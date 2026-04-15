const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const TARGET_CAMPAIGN_ID = '3df78254-1275-4b8a-b825-3fd02a467f1e';

async function investigateJobs() {
  console.log(`========== INVESTIGANDO JOBS DA CAMPAIGN: ${TARGET_CAMPAIGN_ID} ==========`);

  // 1. Buscar Send Jobs
  console.log('\n--- 1. SEND JOBS ---');
  const { data: jobs, error: jobsError } = await supabase
    .from('send_jobs')
    .select('*')
    .eq('campaign_id', TARGET_CAMPAIGN_ID);

  if (jobsError) {
    console.error('Erro ao buscar jobs:', jobsError.message);
  } else {
    console.table(jobs.map(j => ({
        id: j.id,
        destination: j.destination,
        target_id: j.destination_id || j.target_id || 'N/A', // Verificar qual campo é usado
        status: j.status,
        error: j.last_error,
        created_at: j.created_at,
        processed_at: j.processed_at
    })));
  }

  // 2. Buscar Recibos (Se houver)
  console.log('\n--- 2. SEND RECEIPTS ---');
  const { data: receipts, error: receiptsError } = await supabase
    .from('send_receipts')
    .select('*')
    .eq('campaign_id', TARGET_CAMPAIGN_ID);

  if (receiptsError) {
    console.error('Erro ao buscar recibos:', receiptsError.message);
  } else {
    console.table(receipts.map(r => ({
        id: r.id,
        status: r.status,
        target: r.target,
        wasender_id: r.wasender_message_id,
        created_at: r.created_at
    })));
  }

  // 3. Verificar se há jobs PENDENTES globais (Fila travada?)
  console.log('\n--- 3. STATUS GERAL DA FILA (PENDING) ---');
  const { count, error: countError } = await supabase
    .from('send_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
    
  if (countError) console.error('Erro ao contar jobs:', countError.message);
  else console.log(`Existem ${count} jobs PENDENTES no total no banco.`);
}

investigateJobs();
