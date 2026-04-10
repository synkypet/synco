import * as crypto from 'crypto';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { URL } from 'url';

// Carregar variáveis do .env.local
dotenv.config({ path: '.env.local' });

const GRAPHQL_URL = "https://open-api.affiliate.shopee.com.br/graphql";

function sign(appId: string, timestamp: string, body: string, secret: string) {
  const raw = `${appId}${timestamp}${body}${secret}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function extractFromProductUrl(productUrl: string) {
  const url = new URL(productUrl);
  const pathname = decodeURIComponent(url.pathname);

  const match = pathname.match(/-i\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error("Não consegui extrair shopId e itemId da URL.");
  }

  const shopId = match[1];
  const itemId = match[2];

  const keyword = pathname
    .replace(/^\/+/, "")
    .replace(/-i\.\d+\.\d+.*$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    shopId,
    itemId,
    keyword,
    canonicalProductUrl: `https://shopee.com.br/product/${shopId}/${itemId}`,
  };
}

function normalizeText(text: string) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreNode(node: any, target: any) {
  let score = 0;

  if (String(node?.itemId) === String(target.itemId)) score += 100;
  if (String(node?.shopId) === String(target.shopId)) score += 80;

  const productName = normalizeText(node?.productName);
  const keyword = normalizeText(target.keyword);

  if (productName === keyword) score += 60;
  if (productName.includes(keyword) && keyword.length >= 5) score += 40;

  const keywordWords = keyword.split(" ").filter(Boolean);
  for (const word of keywordWords) {
    if (word.length >= 3 && productName.includes(word)) score += 4;
  }

  return score;
}

async function graphqlRequest(appId: string, secret: string, payloadObject: any, debugName: string) {
  // O SEGREDO: JSON 100% compacto
  const body = JSON.stringify(payloadObject, null, 0);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = sign(appId, timestamp, body, secret);

  // IMPORTANTE: Cabeçalho sem espaços
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `SHA256 Credential=${appId},Timestamp=${timestamp},Signature=${signature}`,
  };

  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers,
    body,
  });

  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    fs.writeFileSync(`${debugName}.txt`, text, "utf-8");
    throw new Error(`Resposta não-JSON em ${debugName}. Salvei em ${debugName}.txt`);
  }

  fs.writeFileSync(`${debugName}.json`, JSON.stringify(json, null, 2), "utf-8");

  return {
    httpStatus: response.status,
    json,
    body,
    timestamp,
  };
}

async function main() {
  const appId = process.env.SHOPEE_APP_ID;
  const secret = process.env.SHOPEE_APP_SECRET || process.env.SHOPEE_SECRET;
  const productUrl = process.argv[2];

  if (!appId) {
    throw new Error("SHOPEE_APP_ID não encontrado no .env.local");
  }

  if (!secret) {
    throw new Error("SHOPEE_APP_SECRET ou SHOPEE_SECRET não encontrado no .env.local");
  }

  if (!productUrl) {
    throw new Error("Passe a URL do produto da Shopee no terminal.");
  }

  const target = extractFromProductUrl(productUrl);

  console.log("\n=========== DADOS EXTRAÍDOS DA URL ===========");
  console.log("shopId:", target.shopId);
  console.log("itemId:", target.itemId);
  console.log("keyword:", target.keyword);

  // QUERY 1: Por keyword
  const keywordQuery = {
    query: `
      query BuscarProdutos($keyword: String!, $sortType: Int!, $listType: Int!, $page: Int!, $limit: Int!) {
        productOfferV2(
          sortType: $sortType
          listType: $listType
          page: $page
          limit: $limit
          keyword: $keyword
        ) {
          nodes {
            itemId
            shopId
            shopName
            price
            commissionRate
            productName
            imageUrl
            productCatIds
          }
        }
      }
    `,
    variables: {
      keyword: target.keyword,
      sortType: 1,
      listType: 0,
      page: 1,
      limit: 20,
    },
  };

  console.log("\nExecutando QUERY 1 (Keyword)...");
  const keywordResp = await graphqlRequest(appId, secret, keywordQuery, "01-keyword-response");

  // QUERY 2: Por ID (Exato) - Usando Int64 para evitar erro de schema
  const exactQuery = {
    query: `
      query BuscarExato($shopId: Int64, $itemId: Int64, $page: Int!, $limit: Int!) {
        productOfferV2(
          shopId: $shopId
          itemId: $itemId
          page: $page
          limit: $limit
        ) {
          nodes {
            itemId
            shopId
            shopName
            price
            commissionRate
            productName
            imageUrl
            productCatIds
          }
        }
      }
    `,
    variables: {
      shopId: String(target.shopId),
      itemId: String(target.itemId),
      page: 1,
      limit: 10,
    },
  };

  console.log("Executando QUERY 2 (ID Exato)...");
  const exactResp = await graphqlRequest(appId, secret, exactQuery, "02-exact-response");

  const keywordNodes = keywordResp.json?.data?.productOfferV2?.nodes || [];
  const exactNodes = exactResp.json?.data?.productOfferV2?.nodes || [];
  const mergedNodes = [...exactNodes, ...keywordNodes];

  if (!mergedNodes.length) {
    console.log("\nFATAL: Nenhum produto retornado em nenhuma query.");
    return;
  }

  const ranked = mergedNodes
    .map((node) => ({
      node,
      score: scoreNode(node, target),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0].node;
  const score = ranked[0].score;

  console.log("\n=========== MELHOR MATCH ENCONTRADO ===========");
  console.log("Score:", score);
  console.log("Produto:", best.productName);
  console.log("Loja:", best.shopName);
  console.log("-----------------------------------------------");
  console.log("Preço Bruto:", best.price);
  console.log("Preço Normalizado (10^5):", Number(best.price) / 100000);
  console.log("===============================================");
}

main().catch(console.error);
