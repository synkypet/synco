import pg from 'pg';
import fs from 'fs';
import path from 'path';

async function main() {
  const connectionString = 'postgresql://postgres.vgzcisazfsamfkrhuvhy:Hc9m%.wCk48h,ui@aws-1-us-west-2.pooler.supabase.com:5432/postgres';
  const client = new pg.Client({ connectionString });

  try {
    console.log('--- Conectando ao Supabase... ---');
    await client.connect();
    
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20240421000001_add_eligibility_and_installments_to_campaign_items.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('--- Aplicando Migração de Elegibilidade... ---');
    await client.query(sql);

    console.log('✅ Sucesso! Colunas eligibility_status, eligibility_reasons e installments adicionadas.');
  } catch (err) {
    console.error('❌ Falha ao aplicar migração:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
