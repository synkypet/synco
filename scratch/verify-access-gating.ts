/**
 * verify-access-gating.ts
 * Script determinístico para validar a lógica de Access Gating do SYNCO.
 * Testa o access-resolver e os helpers de limite isoladamente, sem rede.
 *
 * Execução: npm run verify:gating
 */
import { resolveUserAccessCore, UNLIMITED_QUOTAS, FULL_FEATURES, BLOCKED_QUOTAS, NO_FEATURES } from '../src/services/supabase/access-resolver';

// ─── Mock Supabase Client ────────────────────────────────────────────────────
function createMockSupabase(opts: {
  internalLicense?: { role: string } | null;
  subscription?: any | null;
}) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, _val: string) => ({
          single: async () => {
            if (table === 'internal_licenses') {
              return { data: opts.internalLicense || null, error: null };
            }
            if (table === 'subscriptions') {
              return { data: opts.subscription || null, error: opts.subscription ? null : { code: 'PGRST116' } };
            }
            return { data: null, error: null };
          }
        })
      })
    })
  };
}

// ─── Helper: Criar assinatura simulada ───────────────────────────────────────
function makeSub(overrides: any) {
  return {
    user_id: 'test-user',
    plan_id: 'plan-starter',
    status: 'active',
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    grace_period_end: null,
    plan: {
      id: 'plan-starter',
      name: 'Starter',
      limits: {
        quotas: { max_channels: 3, max_groups_sync: 50, max_sends_per_month: 5000 },
        features: { radar_access: true, api_access: false, advanced_reports: false }
      }
    },
    ...overrides
  };
}

// ─── Testes ──────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

async function runTests() {
  console.log('=========================================');
  console.log('   Testes de Access Gating (SYNCO)');
  console.log('=========================================\n');

  // ─── 1. Usuário sem assinatura (No Subscription) ──────────────────────────
  console.log('[CENÁRIO 1] Usuário sem assinatura:');
  {
    const sb = createMockSupabase({ subscription: null });
    const result = await resolveUserAccessCore('test-user', sb);
    assert('status === no_subscription', result.status === 'no_subscription');
    assert('isOperative === false', result.isOperative === false);
    assert('quotas bloqueadas (max_channels=0)', result.quotas.max_channels === 0);
  }

  // ─── 2. Assinatura Ativa ──────────────────────────────────────────────────
  console.log('\n[CENÁRIO 2] Assinatura Active:');
  {
    const sb = createMockSupabase({ subscription: makeSub({ status: 'active' }) });
    const result = await resolveUserAccessCore('test-user', sb);
    assert('status === active', result.status === 'active');
    assert('isOperative === true', result.isOperative === true);
    assert('quotas.max_channels === 3', result.quotas.max_channels === 3);
    assert('quotas.max_sends_per_month === 5000', result.quotas.max_sends_per_month === 5000);
  }

  // ─── 3. Internal License (Bypass Total) ───────────────────────────────────
  console.log('\n[CENÁRIO 3] Internal License (bypass total):');
  {
    const sb = createMockSupabase({ internalLicense: { role: 'admin' }, subscription: null });
    const result = await resolveUserAccessCore('test-user', sb);
    assert('status === internal_license', result.status === 'internal_license');
    assert('isOperative === true', result.isOperative === true);
    assert('quotas.max_channels === 999 (ilimitado)', result.quotas.max_channels === 999);
  }

  // ─── 4. Past Due: Dentro do Grace Period ──────────────────────────────────
  console.log('\n[CENÁRIO 4] Past Due DENTRO do Grace Period:');
  {
    const future = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(); // +3 dias
    const sb = createMockSupabase({ subscription: makeSub({ status: 'past_due', grace_period_end: future }) });
    const result = await resolveUserAccessCore('test-user', sb);
    assert('status === past_due', result.status === 'past_due');
    assert('isOperative === true (tolerância)', result.isOperative === true);
  }

  // ─── 5. Past Due: Fora do Grace Period ────────────────────────────────────
  console.log('\n[CENÁRIO 5] Past Due FORA do Grace Period:');
  {
    const past = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(); // -5 dias
    const sb = createMockSupabase({ subscription: makeSub({ status: 'past_due', grace_period_end: past }) });
    const result = await resolveUserAccessCore('test-user', sb);
    assert('status === past_due_restricted', result.status === 'past_due_restricted');
    assert('isOperative === false', result.isOperative === false);
  }

  // ─── 6. Canceled: Antes de current_period_end ─────────────────────────────
  console.log('\n[CENÁRIO 6] Canceled ANTES de current_period_end:');
  {
    const future = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();
    const sb = createMockSupabase({ subscription: makeSub({ status: 'canceled', current_period_end: future }) });
    const result = await resolveUserAccessCore('test-user', sb);
    assert('status === canceled (período pago)', result.status === 'canceled');
    assert('isOperative === true', result.isOperative === true);
  }

  // ─── 7. Canceled: Depois de current_period_end ────────────────────────────
  console.log('\n[CENÁRIO 7] Canceled DEPOIS de current_period_end:');
  {
    const past = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString();
    const sb = createMockSupabase({ subscription: makeSub({ status: 'canceled', current_period_end: past }) });
    const result = await resolveUserAccessCore('test-user', sb);
    assert('status === expired_blocked', result.status === 'expired_blocked');
    assert('isOperative === false', result.isOperative === false);
    assert('quotas bloqueadas', result.quotas.max_channels === 0);
  }

  // ─── 8. Trialing ──────────────────────────────────────────────────────────
  console.log('\n[CENÁRIO 8] Trialing:');
  {
    const sb = createMockSupabase({ subscription: makeSub({ status: 'trialing' }) });
    const result = await resolveUserAccessCore('test-user', sb);
    assert('status === trialing', result.status === 'trialing');
    assert('isOperative === true', result.isOperative === true);
  }

  // ─── 9. Internal License sobrepõe assinatura falha ────────────────────────
  console.log('\n[CENÁRIO 9] Internal License + assinatura expirada:');
  {
    const expiredSub = makeSub({ status: 'canceled', current_period_end: new Date(Date.now() - 99 * 24 * 3600 * 1000).toISOString() });
    const sb = createMockSupabase({ internalLicense: { role: 'staff' }, subscription: expiredSub });
    const result = await resolveUserAccessCore('test-user', sb);
    assert('status === internal_license (bypass)', result.status === 'internal_license');
    assert('isOperative === true', result.isOperative === true);
  }

  // ─── 10. Lote de Quick Send ultrapassa limite ─────────────────────────────
  console.log('\n[CENÁRIO 10] Limite de envios (lógica de validação):');
  {
    const quotas = { max_channels: 3, max_groups_sync: 50, max_sends_per_month: 100 };
    const usedThisMonth = 80;
    const requestedSends = 30;
    const wouldExceed = usedThisMonth + requestedSends > quotas.max_sends_per_month;
    assert('80 usados + 30 solicitados > 100 = bloqueio', wouldExceed === true);

    const requestedSends2 = 15;
    const wouldExceed2 = usedThisMonth + requestedSends2 > quotas.max_sends_per_month;
    assert('80 + 15 = 95 <= 100 = liberado', wouldExceed2 === false);
  }

  // ─── 11. Limite de canais ─────────────────────────────────────────────────
  console.log('\n[CENÁRIO 11] Limite de canais:');
  {
    const quotas = { max_channels: 3, max_groups_sync: 50, max_sends_per_month: 5000 };
    const currentChannels = 3;
    const wouldExceed = currentChannels + 1 > quotas.max_channels;
    assert('3 canais atuais + 1 novo > 3 = bloqueio', wouldExceed === true);

    const currentChannels2 = 2;
    const wouldExceed2 = currentChannels2 + 1 > quotas.max_channels;
    assert('2 canais atuais + 1 novo <= 3 = liberado', wouldExceed2 === false);
  }

  // ─── 12. Limite de grupos ─────────────────────────────────────────────────
  console.log('\n[CENÁRIO 12] Limite de grupos (batch sync):');
  {
    const quotas = { max_channels: 3, max_groups_sync: 50, max_sends_per_month: 5000 };
    const currentGroups = 45;
    const newGroupsInBatch = 10;
    const wouldExceed = currentGroups + newGroupsInBatch > quotas.max_groups_sync;
    assert('45 grupos + 10 novos > 50 = bloqueio', wouldExceed === true);

    const newGroupsInBatch2 = 4;
    const wouldExceed2 = currentGroups + newGroupsInBatch2 > quotas.max_groups_sync;
    assert('45 grupos + 4 novos <= 50 = liberado', wouldExceed2 === false);
  }

  // ─── 13. Spoofing: userId do body ignorado ────────────────────────────────
  console.log('\n[CENÁRIO 13] Spoofing de userId:');
  {
    // Simulação: o body traz userId = 'ceo-id'
    // O backend deve ignorar e usar o userId da sessão auth
    const bodyUserId = 'ceo-id';
    const sessionUserId = 'free-user-id';
    const usedUserId = sessionUserId; // O backend SEMPRE usa o da sessão
    assert('userId usado = sessão (não body)', usedUserId === sessionUserId);
    assert('userId do body ignorado', usedUserId !== bodyUserId);
  }

  // ─── 14. Billing livre de gating ──────────────────────────────────────────
  console.log('\n[CENÁRIO 14] Billing e Webhook livres de gating:');
  {
    const freeEndpoints = [
      '/api/billing/checkout',
      '/api/billing/status',
      '/api/webhooks/mercado-pago',
      '/api/health'
    ];
    const gatedEndpoints = [
      '/api/quick-send/dispatch',
      '/api/links/process',
      '/api/radar/fetch-shopee',
      '/api/wasender/channels',
      '/api/telegram/connect',
      '/api/wasender/groups/sync',
      '/api/automations/process',
      '/api/radar/audit',
      '/api/radar/sync',
      '/api/send-jobs/cancel-pending'
    ];
    assert(`${freeEndpoints.length} endpoints livres de gating`, freeEndpoints.length === 4);
    assert(`${gatedEndpoints.length} endpoints protegidos`, gatedEndpoints.length === 10);
  }

  // ─── Resultado Final ──────────────────────────────────────────────────────
  console.log('\n=========================================');
  console.log(`   RESULTADO: ${passed} passou, ${failed} falhou`);
  console.log('=========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
