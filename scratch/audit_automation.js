const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function auditAutomationConfig() {
  console.log('========== AUDITORIA DE CONFIGURAÇÃO DE AUTOMAÇÃO ==========');

  // 1. Buscar fontes ativas
  console.log('\n--- 1. FONTES ATIVAS (automation_sources) ---');
  const { data: sources, error: sourceError } = await supabase
    .from('automation_sources')
    .select('*')
    .eq('is_active', true);

  if (sourceError) {
    console.error('Erro ao buscar fontes:', sourceError.message);
    return;
  }
  console.table(sources.map(s => ({
    id: s.id,
    nome: s.name,
    external_group_id: s.external_group_id,
    user_id: s.user_id,
    channel_id: s.channel_id
  })));

  // 2. Buscar rotas ativas
  console.log('\n--- 2. ROTAS ATIVAS (automation_routes) ---');
  const { data: routes, error: routeError } = await supabase
    .from('automation_routes')
    .select('*')
    .eq('is_active', true);

  if (routeError) {
    console.error('Erro ao buscar rotas:', routeError.message);
    return;
  }

  // 3. Buscar nomes de grupos para mapear destinos
  console.log('\n--- 3. MAPEAMENTO COMPLETO (Source -> Rota -> Target) ---');
  const { data: groups, error: groupError } = await supabase
    .from('groups')
    .select('id, name, remote_id');

  const groupMap = new Map((groups || []).map(g => [g.id, g]));

  const auditTable = routes.map(r => {
    const source = sources.find(s => s.id === r.source_id);
    const target = groupMap.get(r.target_id);
    
    return {
      source_name: source?.name || '?',
      source_jid: source?.external_group_id || '?',
      route_id: r.id,
      target_name: target?.name || '?',
      target_jid: target?.remote_id || '?'
    };
  });

  console.table(auditTable);

  const targetTest1 = '120363429112097124@g.us';
  const targetTest2 = '120363407334133457@g.us';
  const targetTest3 = '120363404369710323@g.us';

  console.log('\n--- 4. BUSCA DE GRUPOS DISPONÍVEIS NO WHATSAPP (tabela groups) ---');
  const matchGroups = groups?.filter(g => 
    [targetTest1, targetTest2, targetTest3].includes(g.remote_id)
  );
  console.table(matchGroups);
}

auditAutomationConfig();
