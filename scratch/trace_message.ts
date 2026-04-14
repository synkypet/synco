import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TARGET_MESSAGE_ID = '3EB0126356DF674DA54EA1';

async function traceMessage() {
  console.log(`========== INSPECIONANDO MENSAGEM: ${TARGET_MESSAGE_ID} ==========`);

  // 1. Buscar na tabela de deduplicação (Dedupe Camada 0)
  console.log('\n--- 1. VERIFICANDO DEDUPE (Camada 0) ---');
  const { data: dedupe, error: dedupeError } = await supabase
    .from('automation_dedupe')
    .select('*')
    .filter('hash_key', 'ilike', `%${TARGET_MESSAGE_ID}%`);

  if (dedupeError) console.error('Erro ao buscar dedupe:', dedupeError.message);
  else console.table(dedupe);

  // 2. Buscar nos logs de automação
  console.log('\n--- 2. LOGS DE AUTOMAÇÃO NO BANCO ---');
  const { data: logs, error: logsError } = await supabase
    .from('automation_logs')
    .select('*')
    .order('created_at', { ascending: false });
  
  const filteredLogs = logs?.filter(log => 
    JSON.stringify(log.details).includes(TARGET_MESSAGE_ID)
  ) || [];

  if (logsError) console.error('Erro ao buscar logs:', logsError.message);
  else console.table(filteredLogs.map(l => ({ 
    time: l.created_at, 
    type: l.event_type, 
    status: l.status, 
    source_id: l.source_id 
  })));

  if (filteredLogs.length > 0) {
    const sourceId = filteredLogs[0].source_id;
    console.log(`\nLocalizada Source ID: ${sourceId}. Buscando todos os logs recentes desta fonte...`);
    
    const { data: sourceLogs } = await supabase
       .from('automation_logs')
       .select('*')
       .eq('source_id', sourceId)
       .order('created_at', { ascending: false })
       .limit(10);
       
    console.table(sourceLogs?.reverse().map(l => ({ 
        time: l.created_at, 
        type: l.event_type, 
        status: l.status,
        details_snippet: JSON.stringify(l.details).substring(0, 50)
    })));
  }

  // 3. Buscar Campanhas criadas recentemente
  console.log('\n--- 3. CAMPANHAS RECENTES ---');
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  console.table(campaigns);

  if (campaigns && campaigns.length > 0) {
    const campaignId = campaigns[0].id;
    console.log(`\nVerificando Items e Jobs da campanha mais recente: ${campaignId}`);
    
    const { data: items } = await supabase
      .from('campaign_items')
      .select('id, product_name, affiliate_url')
      .eq('campaign_id', campaignId);
    
    console.log('Itens da Campanha:');
    console.table(items);

    const { data: jobs } = await supabase
      .from('send_jobs')
      .select('id, destination, status, last_error, created_at')
      .eq('campaign_id', campaignId);
    
    console.log('Jobs Gerados:');
    console.table(jobs);
  }
}

traceMessage();
