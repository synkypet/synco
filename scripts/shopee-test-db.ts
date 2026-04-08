import { createClient } from '@supabase/supabase-js';
import { createHash, createDecipheriv } from 'crypto';

// Função de decrypt copiada de src/lib/encryption.ts
function decrypt({ encryptedValue, iv, authTag }: { encryptedValue: string, iv: string, authTag: string }): string {
    const ENCRYPTION_KEY = process.env.SYNCO_MASTER_KEY;
    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
      throw new Error('ENCRYPTION_KEY is required and must be 32 bytes (64 hex characters)');
    }
  
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(iv, 'hex')
    );
  
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
    let decrypted = decipher.update(encryptedValue, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
  
    return decrypted;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const result: any = {};
  console.log('Buscando conta da Shopee no banco...');
  const { data: connections, error } = await supabase
    .from('user_marketplaces')
    .select('*, marketplaces!inner(name)')
    .eq('marketplaces.name', 'Shopee');
    
  if (error || !connections || connections.length === 0) {
    result.error = 'Nenhuma conexão da Shopee encontrada.';
    require('fs').writeFileSync('shopee-test-result.json', JSON.stringify(result, null, 2));
    return;
  }

  const conn = connections.find(c => c.shopee_app_id);
  if (!conn) {
    result.error = 'Nenhum appID encontrado nas contas.';
    require('fs').writeFileSync('shopee-test-result.json', JSON.stringify(result, null, 2));
    return;
  }

  const { data: secretData } = await supabase
    .from('user_marketplace_secrets')
    .select('*')
    .eq('marketplace_id', conn.marketplace_id)
    .single();

  if (!secretData) {
    result.error = 'Nenhum secret encontrado.';
    require('fs').writeFileSync('shopee-test-result.json', JSON.stringify(result, null, 2));
    return;
  }

  const secret = decrypt({
    encryptedValue: secretData.encrypted_secret,
    iv: secretData.iv,
    authTag: secretData.auth_tag
  });

  result.appId = conn.shopee_app_id;

  // GraphQL
  result.graphql = { introspection: {}, productList: {} };
  
  // 1. GraphQL Introspection
  const apiUrl = 'https://open-api.affiliate.shopee.com.br/graphql';
  const query = `
    query __introspection {
      __type(name: "Query") {
        fields {
          name
          args {
            name
            type {
              name
              kind
              ofType {
                name
                kind
                ofType {
                  name
                }
              }
            }
          }
        }
      }
    }
  `;
  const payload = JSON.stringify({ query });
  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `${conn.shopee_app_id}${timestamp}${payload}${secret}`;
  console.log('HMAC base string setup ok');
  
  const signature = createHash('sha256').update(baseString).digest('hex');
  const authHeader = `SHA256 Credential=${conn.shopee_app_id}, Timestamp=${timestamp}, Signature=${signature}`;

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
      body: payload
    });
    result.graphql.introspection.status = res.status;
    const json = await res.json();
    result.graphql.introspection.response = json;
  } catch (err: any) {
    result.graphql.introspection.error = err.message;
  }

  // 2. GraphQL productList
  const plQuery = `
    query productOfferV2($shopId: Int64, $itemId: Int64) {
      productOfferV2(shopId: $shopId, itemId: $itemId) {
        nodes {
          productName
          imageUrl
          price
          commission
          commissionRate
        }
      }
    }
  `;
  const plPayload = JSON.stringify({
    query: plQuery,
    variables: { shopId: "1235724103", itemId: "58204359689" }
  });
  
  const plTimestamp = Math.floor(Date.now() / 1000);
  const plBaseStr = `${conn.shopee_app_id}${plTimestamp}${plPayload}${secret}`;
  const plSignature = createHash('sha256').update(plBaseStr).digest('hex');
  const plAuth = `SHA256 Credential=${conn.shopee_app_id}, Timestamp=${plTimestamp}, Signature=${plSignature}`;
  
  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': plAuth },
      body: plPayload
    });
    result.graphql.productList.status = res.status;
    const json = await res.json();
    result.graphql.productList.response = json;
  } catch (err: any) {
    result.graphql.productList.error = err.message;
  }

  // 3. REST v2
  result.restV2 = {};
  const host = 'https://partner.shopeemobile.com'; 
  const pathPart = '/api/v2/affiliate/offer/product'; 
  const timestamp2 = Math.floor(Date.now() / 1000);
  const sigBase = `${conn.shopee_app_id}${pathPart}${timestamp2}`;
  const crypto = require('crypto');
  const hmacSign = crypto.createHmac('sha256', secret).update(sigBase).digest('hex');
  const url = `${host}${pathPart}?partner_id=${conn.shopee_app_id}&timestamp=${timestamp2}&sign=${hmacSign}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_url: "https://shopee.com.br/Patinete-El%C3%A9trico-De-350w-Com-Uma-Bateria-De-Alta-Alcan%C3%A7a-Velocidades-De-25-30km-h-Com-Autonomia-De-4-5-Horas-i.1235724103.58204359689"
      })
    });
    result.restV2.status = res.status;
    const bodyText = await res.text();
    try {
        result.restV2.response = JSON.parse(bodyText);
    } catch {
        result.restV2.response = bodyText;
    }
  } catch (err: any) {
    result.restV2.error = err.message;
  }

  require('fs').writeFileSync('shopee-test-result.json', JSON.stringify(result, null, 2));
}

run();
