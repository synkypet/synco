import { processLinks } from './src/lib/linkProcessor';

async function test() {
  const text = `🛍️Kit Wella Professionals Oil Reflections Tratamento (3 Produtos)\n\nde R$ 355,90\n💥por R$ 251,00 \n💳 ou 5x de R$53,16  sem juros\n\nCompre aqui: https://s.shopee.com.br/8KmnyZXrVW\n\nPara chegar nesse valor, resgate aqui o cupom de R$30,20 OFF EXCLUSIVO PARA KIT WELLA: https://s.shopee.com.br/40doobtznS`;
  const result = await processLinks(['https://s.shopee.com.br/8KmnyZXrVW'], [], 'auto', undefined, undefined, text);
  
  console.log(JSON.stringify(result, null, 2));
}
test().catch(console.error);
