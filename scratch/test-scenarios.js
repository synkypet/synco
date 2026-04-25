const { createAdminClient } = require('./src/lib/supabase/admin');

const userId = '59cd0337-2f39-43ce-a596-cd068a1df7f6';

async function runScenario(name) {
  const supabase = createAdminClient();
  console.log(`\n>>> EXECUTANDO CENÁRIO: ${name}`);

  try {
    switch (name) {
      case 'internal_license':
        await supabase.from('subscriptions').delete().eq('user_id', userId);
        await supabase.from('internal_licenses').upsert({ user_id: userId, role: 'admin' });
        break;

      case 'active':
        await supabase.from('internal_licenses').delete().eq('user_id', userId);
        const { data: plan } = await supabase.from('plans').select('id').eq('name', 'Pro').single();
        await supabase.from('subscriptions').upsert({
          user_id: userId,
          plan_id: plan.id,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        });
        break;

      case 'past_due':
        await supabase.from('subscriptions').update({ status: 'past_due' }).eq('user_id', userId);
        break;

      case 'expired':
        await supabase.from('subscriptions').update({ status: 'expired' }).eq('user_id', userId);
        break;

      case 'cleanup':
        await supabase.from('subscriptions').delete().eq('user_id', userId);
        await supabase.from('internal_licenses').upsert({ user_id: userId, role: 'admin' });
        break;
    }
    console.log(`✓ Cenário ${name} aplicado.`);
  } catch (e) {
    console.error(`✗ Erro no cenário ${name}:`, e.message);
  }
}

const scenario = process.argv[2];
if (scenario) {
  runScenario(scenario);
} else {
  console.log('Uso: node test-scenarios.js <scenario_name>');
}
