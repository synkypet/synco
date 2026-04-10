// scripts/test-shopee-v2.ts
import { ShopeeAffiliateClient } from '../src/lib/shopee-affiliate/client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function test() {
  const client = new ShopeeAffiliateClient({
    appId: process.env.SHOPEE_APP_ID,
    secret: process.env.SHOPEE_APP_SECRET
  });

  const url = 'https://shopee.com.br/Smartphone-Xiaomi-Redmi-Note-13-128GB-6GB-RAM-Global-Version-i.312384661.24072382944';
  
  console.log('--- TESTANDO SHORT LINK ---');
  try {
    const short = await client.generateShortLink(url);
    console.log('Short Link:', short);
  } catch (e: any) {
    console.error('Erro Short Link:', e.message);
  }

  console.log('\n--- TESTANDO METADADOS V2 ---');
  // Extrai shopId e itemId da URL de teste
  const idMatch = url.match(/i\.(\d+)\.(\d+)/);
  const shopId = idMatch?.[1] || '';
  const itemId = idMatch?.[2] || '';
  try {
    const nodes = await client.searchProducts({ shopId, itemId });
    console.log('Nodes returned:', nodes.length);
    if (nodes.length > 0) {
      console.log('DADOS REAIS:', JSON.stringify(nodes[0], null, 2));
    } else {
      console.log('API RETORNOU VAZIO (Nenhum nó encontrado para esta URL)');
    }
  } catch (e: any) {
    console.error('Erro Metadados V2:', e.message);
  }
}

test();
