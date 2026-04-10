import { processLinks } from '../src/lib/linkProcessor';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function e2e_validation() {
  const scenarios = [
    {
      name: "Cenário 1: Ideal (priceMin + Commission)",
      url: "https://shopee.com.br/Celular-Apple-iPhone-17-256GB-5G-Tela-6-3-120Hz-48MP-iOS-Original-Novo-Lacrado-com-Garantia-Apple-i.1673405419.22399376488"
    },
    {
      name: "Cenário 2: Produto Padrão (priceMin exists, but price fallback possible)",
      url: "https://shopee.com.br/Tablet-Pc-Mil10-Android-13-256gb-Mem%C3%B3ria-6gb-Ram10-Polegadas-Tablet-Pc-Milli-UNIF-i.1296642221.22993672474"
    },
    {
      name: "Cenário 3: Produto Quarto Infantil (Testar comissões e sources)",
      url: "https://shopee.com.br/Quarto-Infantil-Completo-Guarda-Roupa-4-Portas-2-Gavetas-com-C%C3%B4moda-Liz-Espresso-M%C3%B3veis-Branco-Fosco-Nature-i.855489892.18699308396"
    }
  ];

  const userConnections = [{
    marketplace_name: 'Shopee',
    shopee_app_id: process.env.SHOPEE_APP_ID,
    shopee_app_secret: process.env.SHOPEE_APP_SECRET
  }];

  console.log("=== INICIANDO VALIDAÇÃO E2E FINAL SHOPEE PRO ===");
  
  for (const scen of scenarios) {
    console.log(`\n\x1b[35m[${scen.name}]\x1b[0m`);
    const results = await processLinks([scen.url], userConnections, 'vendedor');
    const res = results[0];

    if (res.metadata.source === 'fallback') {
      console.log("❌ Falha crítica: caiu em fallback.");
      continue;
    }

    console.log(`- URL: ${scen.url.substring(0, 60)}...`);
    console.log(`- Preço Factual: ${res.factual.priceFormatted} (Retornado pela API Campo: ${res.factual.currentPriceSource})`);
    console.log(`- Pix Estimado: ${res.factual.estimatedPixPriceFormatted} (Metodologia: ${res.factual.estimatedPixSource})`);
    console.log(`- Comissão Factual: ${res.factual.commissionValueFormatted} (Fonte API: ${res.factual.commissionSource})`);
    console.log(`- Preço Riscado: ${res.factual.originalPriceFormatted} (Fonte API: priceMax)`);
    console.log(`- Detalhes Raw: Price=${res.factual.currentPriceFactual}, Commission=${res.factual.commissionValueFactual}`);
  }
}

e2e_validation().catch(console.error);
