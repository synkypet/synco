// scripts/introspect-shopee.ts
import { generateShopeeSignature } from '../src/lib/shopee-affiliate/signature';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function introspect() {
  const appId = process.env.SHOPEE_APP_ID || '';
  const secret = process.env.SHOPEE_APP_SECRET || '';
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
              }
            }
          }
        }
      }
    }
  `;

  const payload = JSON.stringify({ query });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateShopeeSignature(appId, timestamp, payload, secret);
  const authHeader = `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
      body: payload
    });
    const json = await res.json();
    const fields = json.data?.__type?.fields || [];
    const target = fields.find((f: any) => f.name === 'productOfferV2');
    
    if (target) {
      console.log('--- PRODUCTOFFERV2 SCHEMA ---');
      console.log(JSON.stringify(target, null, 2));
    } else {
      console.log('productOfferV2 field not found in Query type.');
      console.log('Available fields:', fields.map((f: any) => f.name).join(', '));
    }
  } catch (e: any) {
    console.error('Error:', e.message);
  }
}

introspect();
