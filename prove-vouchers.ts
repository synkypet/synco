
import { createDecipheriv, createHash } from 'crypto';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Valores fixos do .env.local para evitar erros de context
const MASTER_KEY = "ebf865a7e066679826a966f4b42cb8e6a6523d6901f00b5216bb75815ae25311";
const APP_ID = "18363940729";
const SECRET_ENCRYPTED = "ab39063676e18c9c831583ecf103f25910076593d41361494c87504992b0637e";
const IV = "05521bd2cb0a5a235d1767db34b05a02";
const AUTH_TAG = "9e30a1ea4f6892d3f91c6a58297e8dbb";

function decrypt() {
    const key = Buffer.from(MASTER_KEY, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(IV, 'hex'));
    decipher.setAuthTag(Buffer.from(AUTH_TAG, 'hex'));
    let decrypted = decipher.update(SECRET_ENCRYPTED, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

async function discover() {
  const secret = decrypt();
  const apiUrl = 'https://open-api.affiliate.shopee.com.br/graphql';

  const fetchGraphQL = async (query: string, variables: any = {}) => {
    const payload = JSON.stringify({ query, variables });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHash('sha256').update(`${APP_ID}${timestamp}${payload}${secret}`).digest('hex');
    const authHeader = `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${signature}`;
    const res = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': authHeader }, body: payload });
    return await res.json();
  };

  console.log('--- PROVA REAL DE CAMPOS SHOPEE ---');
  
  // Introspecção do que existe dentro de ProductNode (ou similar)
  // Como não sabemos o nome exato do tipo, vamos perguntar pro Schema sobre productOfferV2
  const q1 = `
    query {
      __type(name: "ProductNode") {
        fields {
          name
          type {
            name
            kind
          }
        }
      }
    }
  `;
  
  const res1 = await fetchGraphQL(q1);
  if (res1.data?.__type) {
    console.log('✅ Tipo detectado: ProductNode');
    const fields = res1.data.__type.fields;
    const voucherFields = fields.filter((f:any) => f.name.toLowerCase().includes('voucher'));
    console.log('Campos de Voucher:', voucherFields.map((f:any) => f.name));
  } else {
    console.log('❌ Tipo ProductNode não encontrado. Tentando introspecção cega de amostragem...');
  }

  // Tentar a query real que sabemos que costuma funcionar em outras regiões
  const q2 = `
    query {
      productOfferV2(limit: 10) {
        nodes {
          productName
          offerVoucher {
            voucherCode
            discountValue
            discountPercentage
            minBasketPrice
          }
        }
      }
    }
  `;
  
  const res2 = await fetchGraphQL(q2);
  if (res2.errors) {
    console.log('❌ Campo offerVoucher FALHOU:', res2.errors[0].message);
  } else {
    console.log('✅ Campo offerVoucher EXISTE e é consultável.');
    const nodes = res2.data.productOfferV2.nodes;
    const withVoucher = nodes.filter((n:any) => n.offerVoucher);
    console.log(`Amostra: ${withVoucher.length} produtos com cupom.`);
    if (withVoucher.length > 0) {
        console.log('DADO REAL:', JSON.stringify(withVoucher[0].offerVoucher, null, 2));
    }
  }
}

discover().catch(console.error);
