
import { buildMessageFromSnapshot, FactualData } from './src/lib/linkProcessor';

const mockFactualDePor: FactualData = {
    title: "Smartphone Gamer XYZ",
    price: 1500,
    priceFormatted: "R$ 1.500,00",
    originalPrice: 2000,
    originalPriceFormatted: "R$ 2.000,00",
    finalLinkToSend: "https://shope.ee/test-depor",
    marketplace: 'Shopee',
    originalUrl: '...',
    cleanUrl: '...',
    fetchedAt: '...'
} as any;

const mockFactualSingle: FactualData = {
    title: "Fone de Ouvido Bluetooth",
    price: 150,
    priceFormatted: "R$ 150,00",
    originalPrice: 150,
    originalPriceFormatted: "R$ 150,00",
    finalLinkToSend: "https://shope.ee/test-single",
    marketplace: 'Shopee',
    originalUrl: '...',
    cleanUrl: '...',
    fetchedAt: '...'
} as any;

console.log("--- CASO DE/POR ---");
console.log(buildMessageFromSnapshot(mockFactualDePor));
console.log("\n--- CASO SINGLE ---");
console.log(buildMessageFromSnapshot(mockFactualSingle));
