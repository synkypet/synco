import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const GRAPHQL_URL = "https://open-api.affiliate.shopee.com.br/graphql";

function sign(appId: string, timestamp: string, body: string, secret: string) {
  const raw = `${appId}${timestamp}${body}${secret}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function tryQuery(fields: string[]) {
  const appId = process.env.SHOPEE_APP_ID!;
  const secret = process.env.SHOPEE_APP_SECRET || process.env.SHOPEE_SECRET!;
  
  const payloadObj = {
    query: `
      query productOfferV2($shopId: Int64, $itemId: Int64) {
        productOfferV2(shopId: $shopId, itemId: $itemId, limit: 1) {
          nodes {
            productName
            ${fields.join('\n            ')}
          }
        }
      }
    `,
    variables: {
      shopId: "1296642221", // Loja do Tablet
      itemId: "22993672474"  // ID do Tablet
    }
  };

  const body = JSON.stringify(payloadObj, null, 0);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = sign(appId, timestamp, body, secret);

  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `SHA256 Credential=${appId},Timestamp=${timestamp},Signature=${signature}`,
    },
    body,
  });

  return await response.json();
}

async function discover() {
  const fieldsToTest = [
    "price", "priceMin", "priceMax", "commissionRate", "commission", 
    "priceDiscountRate", "sellerCommissionRate", "shopeeCommissionRate"
  ];
  
  console.log("Iniciando descoberta de campos...");
  
  const results: any = {};
  
  for (const field of fieldsToTest) {
    try {
      const res: any = await tryQuery([field]);
      if (res.errors) {
        console.log(`❌ Campo [${field}]: Erro - ${res.errors[0].message}`);
        results[field] = { status: "error", error: res.errors[0].message };
      } else {
        const val = res.data?.productOfferV2?.nodes?.[0]?.[field];
        console.log(`✅ Campo [${field}]: EXISTE (Valor: ${val})`);
        results[field] = { status: "ok", value: val };
      }
    } catch (e: any) {
      console.log(`❌ Campo [${field}]: Falha na requisição`);
    }
  }
  
  console.log("\n--- RESULTADO FINAL DA INVESTIGAÇÃO ---");
  console.log(JSON.stringify(results, null, 2));
}

discover().catch(console.error);
