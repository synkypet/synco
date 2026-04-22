// scripts/test-functional-import.ts
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as CryptoJS from 'crypto-js';
import * as Papa from 'papaparse';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const USER_ID = '09309082-83f3-45f9-b5b6-1752f95313ac'; // Usuário yuriglsouza@gmail.com

const COLUMN_MAP: Record<string, string> = {
  'ID do Pedido': 'order_id',
  'ID do Produto': 'product_id',
  'Nome do Produto': 'product_name',
  'Data do Pedido': 'order_time',
  'Status do Pedido': 'order_status',
  'Valor do Pedido': 'checkout_amount',
  'Comissao Estimada': 'estimated_commission',
  'Comissao Real': 'actual_commission',
  'Sub ID': 'sub_id'
};

async function runTest() {
  console.log('--- Iniciando Teste Funcional de Importação ---');
  
  const csvPath = path.join(process.cwd(), 'shopee_mock_report.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf8');

  Papa.parse(csvContent, {
    header: true,
    delimiter: ';',
    complete: async (results) => {
      const orders = results.data.map((row: any) => {
        const normalized: any = { raw_row_json: row };
        
        Object.keys(row).forEach(key => {
          const mappedKey = COLUMN_MAP[key.trim()];
          if (mappedKey) normalized[mappedKey] = row[key];
        });

        // Fingerprint
        normalized.source_row_fingerprint = CryptoJS.SHA256(JSON.stringify(row)).toString();
        
        // Unicidade robusta
        normalized.external_id = normalized.product_id ? `${normalized.order_id}_${normalized.product_id}` : normalized.source_row_fingerprint;

        // Limpeza numérica robusta (Suporta R$ 1.234,56 -> 1234.56)
        const parseNum = (val: any) => {
          if (!val) return 0;
          const clean = String(val).replace(/[R$\s]/g, '').replace(/\.(?=\d{3,}(\,|$))/g, '').replace(',', '.');
          const num = parseFloat(clean);
          return isNaN(num) ? 0 : num;
        };

        const result = {
          user_id: USER_ID,
          external_id: normalized.external_id,
          source_row_fingerprint: normalized.source_row_fingerprint,
          order_id: normalized.order_id,
          product_id: normalized.product_id,
          product_name: normalized.product_name,
          order_time: new Date(normalized.order_time).toISOString(),
          order_status: normalized.order_status,
          checkout_amount: parseNum(normalized.checkout_amount),
          estimated_commission: parseNum(normalized.estimated_commission),
          actual_commission: parseNum(normalized.actual_commission),
          sub_id: normalized.sub_id,
          raw_row_json: row
        };

        console.log(`Mapeado: ${result.order_id} | Est: ${result.estimated_commission} | Act: ${result.actual_commission}`);
        return result;
      });

      console.log(`Lote processado: ${orders.length} pedidos detectados.`);

      // 1. Criar Lote
      const { data: batch } = await supabase
        .from('import_batches')
        .insert({
          user_id: USER_ID,
          filename: 'shopee_mock_report.csv',
          status: 'completed',
          total_rows: orders.length,
          inserted_count: orders.length
        })
        .select()
        .single();

      // 2. Persistir Ordens
      const ordersWithBatch = orders.map(o => ({ ...o, batch_id: batch.id }));
      const { error } = await supabase
        .from('shopee_orders')
        .upsert(ordersWithBatch, { onConflict: 'user_id, external_id' });

      if (error) {
        console.error('❌ Erro no Upsert:', error.message);
      } else {
        console.log('✅ Dados persistidos com sucesso no banco de dados!');
      }
    }
  });
}

runTest();
