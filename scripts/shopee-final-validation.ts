import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const GRAPHQL_URL = "https://open-api.affiliate.shopee.com.br/graphql";

function sign(appId: string, timestamp: string, body: string, secret: string) {
  const raw = `${appId}${timestamp}${body}${secret}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function shopeeRequest(shopId: string, itemId: string) {
  const appId = process.env.SHOPEE_APP_ID!;
  const secret = process.env.SHOPEE_APP_SECRET || process.env.SHOPEE_SECRET!;
  
  const payloadObj = {
    query: `
      query productOfferV2($shopId: Int64, $itemId: Int64) {
        productOfferV2(shopId: $shopId, itemId: $itemId, limit: 1) {
          nodes {
            productName
            price
            priceMin
            priceMax
            commission
            commissionRate
            priceDiscountRate
            sellerCommissionRate
            shopeeCommissionRate
          }
        }
      }
    `,
    variables: { shopId, itemId }
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

function normalize(val: any): number {
  const num = parseFloat(String(val || "0"));
  return num > 50000 ? num / 100000 : num;
}

async function runValidation() {
  const testCases = [
    { name: "Cenário 1: iPhone 17 (Ideal)", shopId: "1673405419", itemId: "22399376488" },
    { name: "Cenário 2: Tablet Milli (Padrão)", shopId: "1296642221", itemId: "22993672474" },
    { name: "Cenário 3: Quarto Liz (Fallback Test)", shopId: "855489892", itemId: "18699308396" }
  ];

  console.log("=== PROVA DE FUNCIONAMENTO REAL (FASE 2) ===");

  for (const tc of testCases) {
    console.log(`\n--- ${tc.name} ---`);
    const res: any = await shopeeRequest(tc.shopId, tc.itemId);
    const node = res.data?.productOfferV2?.nodes?.[0];

    if (!node) {
      console.log("❌ Erro: Produto não encontrado.");
      continue;
    }

    // Lógica espelhada do ShopeeAdapter.ts
    const rawPrice = node.price;
    const rawPriceMin = node.priceMin;
    const rawPriceMax = node.priceMax;
    const rawCommission = node.commission;
    
    const factualPrice = normalize(rawPriceMin || rawPrice);
    const sourcePrice = rawPriceMin ? 'api.priceMin' : 'api.price';
    
    const factualComm = normalize(rawCommission);
    const sourceComm = 'api.commission';
    
    const estimatedPix = factualPrice * 0.92;
    const originalPrice = normalize(rawPriceMax) || factualPrice;

    console.log(`- RAW PriceMin: ${rawPriceMin}, Price: ${rawPrice}, PriceMax: ${rawPriceMax}`);
    console.log(`- RAW Commission: ${rawCommission}, Rate: ${node.commissionRate}`);
    console.log(`- [SNAPSHOT] Price Factual: R$ ${factualPrice.toFixed(2)} (Fonte: ${sourcePrice})`);
    console.log(`- [SNAPSHOT] Original (Riscado): R$ ${originalPrice.toFixed(2)} (Fonte: priceMax)`);
    console.log(`- [SNAPSHOT] Pix Estimado: R$ ${estimatedPix.toFixed(2)} (Metodologia: heuristic.pix_0_92)`);
    console.log(`- [SNAPSHOT] Comissão Factual: R$ ${factualComm.toFixed(2)} (Fonte: ${sourceComm})`);
    
    const displayPrice = factualPrice > 0 ? `R$ ${factualPrice.toFixed(2)}` : "Sob Consulta";
    console.log(`\x1b[32m- VALOR FINAL NO CARD: ${displayPrice}\x1b[0m`);
    if (originalPrice > factualPrice) {
      console.log(`\x1b[33m- VALOR RISCADO NO CARD: R$ ${originalPrice.toFixed(2)}\x1b[0m`);
    }
  }
}

runValidation().catch(console.error);
