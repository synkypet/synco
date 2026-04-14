const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const TARGET_MESSAGE_ID = '3EB0126356DF674DA54EA1';

async function traceMessage() {
  console.log(`========== TRACE: ${TARGET_MESSAGE_ID} ==========`);

  // 1. Logs de Automação
  console.log('\n--- 1. AUTOMATION LOGS ---');
  const { data: logs, error: logsError } = await supabase
    .from('automation_logs')
    .select('*')
    .order('created_at', { ascending: true });

  const filteredLogs = logs?.filter(log => 
    JSON.stringify(log.details).includes(TARGET_MESSAGE_ID)
  ) || [];

  if (filteredLogs.length === 0) {
    console.log('Nenhum log encontrado para este messageId no banco.');
  } else {
    filteredLogs.forEach(l => {
        console.log(`[${l.created_at}] [${l.event_type}] [${l.status}] - Source: ${l.source_id}`);
        console.log(`   Details: ${JSON.stringify(l.details)}`);
    });

    const sourceId = filteredLogs[0].source_id;
    console.log(`\n--- 2. TODOS OS LOGS DA FONTE ${sourceId} ---`);
    const { data: sourceLogs } = await supabase
       .from('automation_logs')
       .select('*')
       .eq('source_id', sourceId)
       .order('created_at', { descending: true })
       .limit(20);
    
    sourceLogs?.reverse().forEach(l => {
        console.log(`[${l.created_at}] [${l.event_type}] [${l.status}]`);
        if (l.event_type === 'error') console.log(`   ERROR: ${JSON.stringify(l.details)}`);
    });
  }

  // 3. Campanhas e Jobs
  console.log('\n--- 3. CAMPANHAS RECENTES ---');
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, created_at')
    .order('created_at', { descending: true })
    .limit(3);

  for (const camp of campaigns || []) {
      console.log(`Campanha: ${camp.id} | ${camp.name} | ${camp.status} | ${camp.created_at}`);
      const { data: jobs } = await supabase.from('send_jobs').select('id, destination, status, last_error').eq('campaign_id', camp.id);
      jobs?.forEach(j => {
          console.log(`   Job: ${j.id} | To: ${j.destination} | Status: ${j.status} | Error: ${j.last_error}`);
      });
  }
}

traceMessage();
