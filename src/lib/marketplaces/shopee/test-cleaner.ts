// src/lib/marketplaces/shopee/test-cleaner.ts
import { cleanProductName } from './cleaner';

const testCases = [
  "🔥 [PROMOÇÃO] Smartphone Samsung Galaxy S23 Ultra ✅ Pronta Entrega",
  "KIT 10 MEIAS MASCULINAS ORIGINAL SHOPEE BRASIL *OFERTA*",
  "🚀 Fone de Ouvido Bluetooth (MELHOR PREÇO) Envío Imediato ✨",
  "【OFERTA DE HOJE】 Relógio Quadrado Luxo - Prata/Preto",
  "📦 Estojo Escolar Grande | Envio Rápido | Promoção 2024"
];

console.log("--- TESTE DE LIMPEZA EDITORIAL ---");
testCases.forEach(input => {
  const output = cleanProductName(input);
  console.log(`Original: ${input}\nLimpo:    ${output}\n`);
});
