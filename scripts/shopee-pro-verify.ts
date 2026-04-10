import { processLinks } from '../src/lib/linkProcessor';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function verify() {
  const links = [
    "https://shopee.com.br/Celular-Apple-iPhone-17-256GB-5G-Tela-6-3-120Hz-48MP-iOS-Original-Novo-Lacrado-com-Garantia-Apple-i.1673405419.22399376488",
    "https://shopee.com.br/Tablet-Pc-Mil10-Android-13-256gb-Mem%C3%B3ria-6gb-Ram10-Polegadas-Tablet-Pc-Milli-UNIF-i.1296642221.22993672474",
    "https://shopee.com.br/Quarto-Infantil-Completo-Guarda-Roupa-4-Portas-2-Gavetas-com-C%C3%B4moda-Liz-Espresso-M%C3%B3veis-Branco-Fosco-Nature-i.855489892.18699308396"
  ];

  // Mock de conexões do usuário que vêm do banco (necessário para o processLink)
  const userConnections = [{
    marketplace_name: 'Shopee',
    shopee_app_id: process.env.SHOPEE_APP_ID,
    shopee_app_secret: process.env.SHOPEE_APP_SECRET
  }];

  console.log("=== INICIANDO VERIFICAÇÃO SHOPEE PRO FASE 1 ===");
  
  const results = await processLinks(links, userConnections, 'promocional');

  results.forEach((res, i) => {
    console.log(`\n--- PRODUTO ${i + 1} ---`);
    console.log(`Título: ${res.factual.title}`);
    console.log(`Preço Factual: ${res.factual.priceFormatted} (Fonte: ${res.factual.currentPriceSource})`);
    console.log(`Pix Estimado: ${res.factual.estimatedPixPrice} (Fonte: ${res.factual.estimatedPixSource})`);
    console.log(`Comissão Factual: ${res.factual.commissionValueFactual} (Fonte: ${res.factual.commissionSource})`);
    console.log(`Log de Auditoria Metadata:`, JSON.stringify({
       rawPrice: res.factual.currentPriceFactual,
       shopeeCommissionRate: res.factual.commissionRate
    }, null, 2));
    console.log(`Copy Gerada:\n${res.copy.messageText}`);
  });
}

verify().catch(console.error);
