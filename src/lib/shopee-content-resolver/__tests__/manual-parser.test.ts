
import { parseShopeeContentBlocks } from '../parser';

async function runTests() {
  console.log('🚀 Iniciando Testes do Parser de Blocos Shopee...\n');

  const cases = [
    {
      name: 'A. 1 cupom multiline completo',
      input: `🔥 CUPOM SHOPEE LIBERADO!
🎟️ Código: M0Z4010
💸 R$15 OFF em compras acima de R$99

🔗 Resgate aqui:
https://s.shopee.com.br/40dNv6Nwu3

⚠️ Sujeito a disponibilidade.`,
      expectedCount: 1
    },
    {
      name: 'B. 2 cupons completos colados',
      input: `🔥 CUPOM 1
Código: AAA
https://s.shopee.com.br/1

🔥 CUPOM 2
Código: BBB
https://s.shopee.com.br/2`,
      expectedCount: 2
    },
    {
      name: 'C. Lista de 3 links puros',
      input: `https://s.shopee.com.br/1
https://s.shopee.com.br/2
https://s.shopee.com.br/3`,
      expectedCount: 3
    },
    {
      name: 'D. Texto misto com separador',
      input: `CUPOM A
https://s.shopee.com.br/a
---
CUPOM B
https://s.shopee.com.br/b`,
      expectedCount: 2
    },
    {
      name: 'E. 2 cupons com disclaimer (Agrupamento)',
      input: `🔥 CUPOM 1
Código: AAA
https://s.shopee.com.br/1
⚠️ Cupom sujeito a disponibilidade Shopee.

🔥 CUPOM 2
Código: BBB
https://s.shopee.com.br/2
⚠️ Cupom sujeito a disponibilidade Shopee.`,
      expectedCount: 2
    }
  ];

  let passed = 0;
  for (const c of cases) {
    const result = parseShopeeContentBlocks(c.input);
    const success = result.length === c.expectedCount;
    
    console.log(`${success ? '✅' : '❌'} [${c.name}]`);
    console.log(`   Esperado: ${c.expectedCount} blocos | Obtido: ${result.length}`);
    if (!success) {
      console.log('   Blocos obtidos:');
      result.forEach((b, i) => console.log(`   --- Bloco ${i+1} ---\n${b}\n`));
    }
    if (success) passed++;
  }

  console.log(`\n📊 Resultado: ${passed}/${cases.length} testes passados.`);
  if (passed !== cases.length) process.exit(1);
}

runTests();
