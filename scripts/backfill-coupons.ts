import { createAdminClient } from '../src/lib/supabase/admin';
import { shopeeCouponService } from '../src/services/supabase/shopee-coupon-service';

async function runBackfill() {
  const isDryRun = process.argv.includes('--dry-run');
  const supabase = createAdminClient();
  
  // Como o sistema é multi-tenant, precisamos buscar todos os usuários que têm cupons
  const { data: users, error: userError } = await supabase
    .from('profiles')
    .select('id');

  if (userError) {
    console.error('Erro ao buscar usuários:', userError);
    return;
  }

  console.log(`[BACKFILL] ${isDryRun ? '[DRY-RUN] ' : ''}Iniciando auditoria para ${users.length} usuários...`);

  const globalStats = {
    total: 0,
    verified: 0,
    product_link: 0,
    rejected: 0,
    candidate: 0,
    examples: {
      verified: [] as any[],
      product_link: [] as any[],
      rejected: [] as any[]
    }
  };

  for (const user of users) {
    try {
      const result = await shopeeCouponService.reverifyAllCandidates(user.id, supabase, { dryRun: isDryRun });
      
      globalStats.total += result.total;
      globalStats.verified += result.verified;
      globalStats.product_link += result.product_link;
      globalStats.rejected += result.rejected;
      globalStats.candidate += result.candidate;
      
      // Merge examples (limit to 3 total per category)
      (['verified', 'product_link', 'rejected'] as const).forEach(cat => {
        if (globalStats.examples[cat].length < 3) {
          globalStats.examples[cat].push(...result.examples[cat].slice(0, 3 - globalStats.examples[cat].length));
        }
      });

    } catch (err) {
      console.error(`[BACKFILL] Erro no usuário ${user.id}:`, err);
    }
  }

  console.log('\n=== RESULTADO DA AUDITORIA ===');
  console.log(`Modo: ${isDryRun ? 'DRY-RUN (Nenhuma alteração feita)' : 'REAL (Dados atualizados no banco)'}`);
  console.log(`Total Analisado: ${globalStats.total}`);
  console.log(`- Verified (Cupons reais): ${globalStats.verified}`);
  console.log(`- Product Link (Produtos confundidos): ${globalStats.product_link}`);
  console.log(`- Rejected (Links bloqueados/inválidos): ${globalStats.rejected}`);
  console.log(`- Candidate (Não alterados): ${globalStats.candidate}`);
  
  console.log('\n=== EXEMPLOS ===');
  console.log('--- VERIFIED ---');
  globalStats.examples.verified.forEach(ex => console.log(`[${ex.id}] ${ex.label || ex.code} -> ${ex.url}`));
  
  console.log('\n--- PRODUCT LINK ---');
  globalStats.examples.product_link.forEach(ex => console.log(`[${ex.id}] ${ex.label || 'Produto'} -> ${ex.url}`));
  
  console.log('\n--- REJECTED ---');
  globalStats.examples.rejected.forEach(ex => console.log(`[${ex.id}] ${ex.label || 'Link Inválido'} -> ${ex.url}`));

  console.log('\n[BACKFILL] Auditoria concluída.');
}

runBackfill();
