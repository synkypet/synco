import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  // Usar Service Role Key para ignorar RLS e executar DDL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase credentials' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20240412000005_add_mesh_tables.sql');
    
    if (!fs.existsSync(migrationPath)) {
       return NextResponse.json({ error: 'Migration file not found at ' + migrationPath }, { status: 404 });
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Infelizmente o supabase-js não permite executar SQL arbitrário via query builder padrão.
    // Precisamos usar .rpc('exec_sql', { sql_query: sql }) se existir uma função helper,
    // ou tentar executar partes via query builder se for DML simples.
    
    // Como DDL (CREATE TABLE/ALTER TABLE) é complexo via fetch, 
    // a melhor forma em ambientes de dev é via CLI.
    // Mas aqui vamos tentar usar um comando de sistema se possível.
    
    return NextResponse.json({ 
       message: 'Por favor, execute a migration via terminal: npx supabase migration up',
       help: 'Ou use o SQL Editor do Supabase com o conteúdo de ' + migrationPath
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
