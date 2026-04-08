// scripts/shopee-test-isolated.ts
import { createHash } from 'crypto';

// Parâmetros para testar
const APP_ID = process.argv[2] || process.env.SHOPEE_APP_ID || '';
const SECRET = process.argv[3] || process.env.SHOPEE_APP_SECRET || '';
const TEST_URL = 'https://shopee.com.br/product/1235724103/58204359689'; // URL aleatória de teste

if (!APP_ID || !SECRET) {
  console.log('Falta APP_ID e SECRET. Passe como argumento: npx tsx scripts/shopee-test-isolated.ts <APP_ID> <SECRET>');
  process.exit(1);
}

// 1. Teste de GraphQL (Estratégia atual do client.ts)
async function testGraphQL() {
  console.log('\n--- TESTANDO ESTRATÉGIA: GraphQL ---');
  const apiUrl = 'https://open-api.affiliate.shopee.com.br/graphql';
  
  // Testaremos a introspecção para ver se o endpoint responde e quais Queries existem
  const query = `
    query __introspection {
      __schema {
        queryType {
          fields {
            name
          }
        }
      }
    }
  `;

  const payload = JSON.stringify({ query });
  const timestamp = Math.floor(Date.now() / 1000);
  
  const baseString = `${APP_ID}${timestamp}${payload}${SECRET}`;
  const signature = createHash('sha256').update(baseString).digest('hex');
  
  const authHeader = `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${signature}`;

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: payload
    });

    const body = await res.text();
    console.log(`HTTP ${res.status} ${res.statusText}`);
    try {
      const json = JSON.parse(body);
      const fields = json.data?.__schema?.queryType?.fields || [];
      console.log('Campos de Query encontrados no Schema:', fields.map((f: any) => f.name).join(', ') || 'Nenhum');
      if (json.errors) console.log('Erros do GraphQL:', JSON.stringify(json.errors, null, 2));
    } catch {
      console.log('Corpo bruto (não-JSON):', body.substring(0, 200));
    }
  } catch (err: any) {
    console.log('Erro de rede/fatal:', err.message);
  }
}

// 2. Teste de REST API v2 (Estratégia Oficial de Parceiros Open API)
async function testRESTv2() {
  console.log('\n--- TESTANDO ESTRATÉGIA: REST API v2 ---');
  const host = 'https://partner.shopeemobile.com'; 
  const path = '/api/v2/auth/access_token/get'; // Apenas para checar se a assinatura HMAC passa na batida da porta (ignora o access_token se responder auth error limpo)
  const timestamp = Math.floor(Date.now() / 1000);
  
  // A assinatura oficial v2 para chamadas sem shop_id
  const baseString = `${APP_ID}${path}${timestamp}`;
  const signature = createHash('sha256').update(baseString, 'utf-8').digest('hex');
  
  const url = `${host}${path}?partner_id=${APP_ID}&timestamp=${timestamp}&sign=${signature}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: "test", partner_id: parseInt(APP_ID), shop_id: 1234 })
    });
    
    const json = await res.json();
    console.log(`HTTP ${res.status}`);
    console.log('Response JSON:', JSON.stringify(json, null, 2));
  } catch (err: any) {
    console.log('Erro de rede:', err.message);
  }
}

async function run() {
  await testGraphQL();
  await testRESTv2();
  console.log('\nFim dos testes isolados.');
}

run();
