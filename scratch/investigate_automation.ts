import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAutomationData() {
  console.log('--- FONTES DE AUTOMAÇÃO ATIVAS ---');
  const { data: sources, error: sourceError } = await supabase
    .from('automation_sources')
    .select(`
      id, 
      name, 
      external_group_id, 
      is_active, 
      channel_id
    `)
    .eq('is_active', true);

  if (sourceError) {
    console.error('Erro ao buscar fontes:', sourceError.message);
  } else {
    console.table(sources);
  }

  console.log('\n--- ROTAS DE AUTOMAÇÃO ---');
  const { data: routes, error: routeError } = await supabase
    .from('automation_routes')
    .select(`
      id, 
      source_id, 
      target_type, 
      target_id, 
      is_active
    `)
    .eq('is_active', true);

  if (routeError) {
    console.error('Erro ao buscar rotas:', routeError.message);
  } else {
    console.table(routes);
  }

  console.log('\n--- VERIFICANDO O GRUPO ESPECÍFICO (120363401177435523@g.us) ---');
  const { data: specificGroup, error: groupError } = await supabase
    .from('groups')
    .select('id, name, remote_id, channel_id')
    .eq('remote_id', '120363401177435523@g.us')
    .maybeSingle();

  if (groupError) {
    console.error('Erro ao buscar grupo:', groupError.message);
  } else if (specificGroup) {
    console.log('Grupo encontrado na tabela groups:', specificGroup);
    
    const { data: specificSource } = await supabase
      .from('automation_sources')
      .select('*')
      .eq('external_group_id', '120363401177435523@g.us');
      
    console.log('Registros em automation_sources para este remote_id:', specificSource);
  } else {
    console.log('Grupo NÃO encontrado na tabela groups com remote_id = 120363401177435523@g.us');
  }
}

checkAutomationData();
