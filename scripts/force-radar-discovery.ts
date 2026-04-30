import { radarDiscoveryService } from '../src/services/radar-discovery-service';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== FORÇANDO CICLO DE DISCOVERY RADAR PRO ===');
  
  // Forçar para todos os usuários e fontes ativas, ignorando cooldown e locks
  const result = await radarDiscoveryService.executeDiscovery(supabase, { force: true });
  
  console.log('\n=== RESULTADO DO CICLO ===');
  console.log(`Fontes processadas: ${result.tasksExecuted}`);
  console.log(`Produtos novos inseridos: ${result.totalInserted}`);
  console.log('\n===========================================');
  console.log('Agora execute a query SQL no Supabase para validar a persistência:');
  console.log(`
SELECT event_type, COUNT(*), MAX(created_at)
FROM radar_activity_log
GROUP BY event_type
ORDER BY COUNT(*) DESC;
  `);
}

main().catch(err => {
  console.error('Falha no ciclo forçado:', err);
  process.exit(1);
});
