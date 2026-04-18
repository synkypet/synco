
import { ShopeeAdapter } from '../src/lib/marketplaces/ShopeeAdapter';

async function testClassification() {
    const adapter = new ShopeeAdapter();
    const testLinks = [
        { url: 'https://s.shopee.com.br/3qJF7VU74l', name: 'Caso A1 (Cupom)' },
        { url: 'https://s.shopee.com.br/3fzovCUkPi', name: 'Caso A2 (Carrinho)' },
        { url: 'https://s.shopee.com.br/16WYvWvHD', name: 'Caso B1 (Promo Landing)' },
        { url: 'https://s.shopee.com.br/LjMxXViwp', name: 'Caso B2 (Produto)' }
    ];

    console.log("--- INICIANDO TESTE DE CLASSIFICAÇÃO FRENTE 2 ---\n");

    for (const test of testLinks) {
        console.log(`Testando ${test.name}: ${test.url}`);
        try {
            const result = await adapter.preProcessIncomingLink(test.url);
            console.log(`Status: ${result.reaffiliation_status}`);
            console.log(`Erro/Motivo: ${result.reaffiliation_error || 'N/A'}`);
            console.log(`URL Canônica: ${result.canonical_url}`);
            console.log("----------------------------------\n");
        } catch (err: any) {
            console.error(`Falha ao processar ${test.name}:`, err.message);
            console.log("----------------------------------\n");
        }
    }
}

testClassification();
