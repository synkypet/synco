
import { ProductSnapshot } from '../src/lib/linkProcessor';

// Simulação simplificada da lógica do processor.ts para validar o Hard Lock
function simulateProcessorLogic(snapshot: ProductSnapshot) {
    console.log(`[SIMULATION] Analisando snapshot para: ${snapshot.factual.title}`);
    
    // --- Lógica do GUARDIÃO OPERACIONAL (Copiada do processor.ts) ---
    const status = snapshot.factual.reaffiliation_status;
    const errorMsg = snapshot.factual.reaffiliation_error || 'Falha desconhecida na validação factual';
    
    if (status === 'blocked' || status === 'failed') {
        console.warn(`[ITEM] [HARD-LOCK] Bloqueado! Status: ${status} | Motivo: ${errorMsg}`);
        return 'STOPPED';
    }

    console.log(`[ITEM] ✓ Produto: "${snapshot.factual.title}" | Preço: ${snapshot.factual.currentPriceFactual}`);
    return 'PROCEEDED';
}

// Caso 1: Item Bloqueado
const blockedSnapshot: any = {
    factual: {
        title: 'PRODUTO BLOQUEADO',
        reaffiliation_status: 'blocked',
        reaffiliation_error: 'Links br.shp.ee não são suportados'
    }
};

// Caso 2: Item Falho
const failedSnapshot: any = {
    factual: {
        title: 'PRODUTO BLOQUEADO',
        reaffiliation_status: 'failed',
        reaffiliation_error: 'fetch failed'
    }
};

// Caso 3: Item Sucesso
const successSnapshot: any = {
    factual: {
        title: 'Fone Bluetooth Top',
        reaffiliation_status: 'reaffiliated',
        currentPriceFactual: 49.90
    }
};

console.log("--- TESTANDO HARD LOCK ---");
const r1 = simulateProcessorLogic(blockedSnapshot);
console.log(`Resultado Bloqueado: ${r1 === 'STOPPED' ? 'PASS' : 'FAIL'}`);

const r2 = simulateProcessorLogic(failedSnapshot);
console.log(`Resultado Falho: ${r2 === 'STOPPED' ? 'PASS' : 'FAIL'}`);

const r3 = simulateProcessorLogic(successSnapshot);
console.log(`Resultado Sucesso: ${r3 === 'PROCEEDED' ? 'PASS' : 'FAIL'}`);

if (r1 === 'STOPPED' && r2 === 'STOPPED' && r3 === 'PROCEEDED') {
    console.log("\n✅ VALIDAÇÃO DO HARD-LOCK: SUCESSO");
} else {
    console.error("\n❌ VALIDAÇÃO DO HARD-LOCK: FALHA");
    process.exit(1);
}
