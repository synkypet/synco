const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const userId = '59cd0337-2f39-43ce-a596-cd068a1df7f6';

async function runScenario(name) {
  console.log(`\n>>> EXECUTANDO CENÁRIO: ${name}`);

  try {
    if (name === 'internal_license' || name === 'cleanup') {
      const { error: delErr } = await supabase.from('subscriptions').delete().eq('user_id', userId);
      if (delErr) console.error('Delete error:', delErr);
      
      const { error: upsertErr } = await supabase.from('internal_licenses').upsert({ user_id: userId, role: 'admin' });
      if (upsertErr) console.error('Upsert error:', upsertErr);
    }
    
    if (name === 'active') {
      await supabase.from('internal_licenses').delete().eq('user_id', userId);
      const { data: plan, error: planErr } = await supabase.from('plans').select('id').eq('name', 'Pro').single();
      if (planErr) throw planErr;
      
      const { error: subErr } = await supabase.from('subscriptions').upsert({
        user_id: userId,
        plan_id: plan.id,
        status: 'active',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
      if (subErr) console.error('Sub error:', subErr);
    }

    if (name === 'past_due') {
      const { error } = await supabase.from('subscriptions').update({ status: 'past_due' }).eq('user_id', userId);
      if (error) console.error('Past due error:', error);
    }

    if (name === 'expired') {
      const { error } = await supabase.from('subscriptions').update({ status: 'expired' }).eq('user_id', userId);
      if (error) console.error('Expired error:', error);
    }

    console.log(`✓ Comando concluído.`);
  } catch (e) {
    console.error(`✗ Erro fatal:`, e.message);
  }
}

const scenario = process.argv[2];
if (scenario) {
  runScenario(scenario);
}
