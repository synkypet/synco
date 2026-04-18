import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function monitor() {
  console.log('--- MONITORAMENTO PÓS-MERGE ---');

  // 1. Verificar eventos de operational_lock (FRENTE 1 & 2)
  const { data: locks, error: lockError } = await supabase
    .from('automation_logs')
    .select('*')
    .eq('event_type', 'operational_lock')
    .order('created_at', { ascending: false })
    .limit(10);

  if (lockError) {
    console.error('Erro ao buscar logs de bloqueio:', lockError);
  } else {
    console.log(`Encontrados ${locks?.length || 0} eventos de operational_lock recentes.`);
    locks?.forEach(l => {
      console.log(`- [${l.created_at}] Motivo: ${l.details?.error} | URL: ${l.details?.url}`);
    });
  }

  // 2. Verificar Send Jobs recentes (FRENTE 3 & 4)
  const { data: jobs, error: jobError } = await supabase
    .from('send_jobs')
    .select('id, status, last_error, processed_at, channel_id')
    .order('processed_at', { ascending: false })
    .limit(20);

  if (jobError) {
    console.error('Erro ao buscar jobs:', jobError);
  } else {
    console.log(`\nÚltimos 20 jobs processados:`);
    const stats = jobs?.reduce((acc: any, j: any) => {
      acc[j.status] = (acc[j.status] || 0) + 1;
      return acc;
    }, {});
    console.log('Estatísticas:', stats);
    
    jobs?.forEach(j => {
      if (j.status === 'failed') {
        console.log(`- [FAILED] Job ${j.id}: ${j.last_error}`);
      }
    });

    // Verificar se há indícios de 401 ou 508 nos erros
    const has401 = jobs?.some(j => j.last_error?.includes('401') || j.last_error?.includes('Unauthorized'));
    const has508 = jobs?.some(j => j.last_error?.includes('508') || j.last_error?.includes('Loop Detected'));
    
    console.log(`\nDetecção de Erros Críticos:`);
    console.log(`- Erros 401 (Auth Host): ${has401 ? 'DETECTADO ⚠️' : 'NENHUM ✅'}`);
    console.log(`- Erros 508 (Loop): ${has508 ? 'DETECTADO ⚠️' : 'NENHUM ✅'}`);
  }

  // 3. Verificar se o Deadline foi atingido (FRENTE 4)
  const { data: deadlineLogs, error: deadlineError } = await supabase
    .from('send_jobs')
    .select('id, last_error')
    .ilike('last_error', '%deadline%')
    .limit(5);

  console.log(`\nDetecção de Deadlines (FRENTE 4):`);
  if (deadlineLogs && deadlineLogs.length > 0) {
    console.log(`- Foram encontrados ${deadlineLogs.length} casos de deadline atingido. (Comportamento esperado em batches longos)`);
  } else {
    console.log(`- Nenhum deadline atingido recentemente.`);
  }

  console.log('\n--- FIM DO MONITORAMENTO ---');
}

monitor();
