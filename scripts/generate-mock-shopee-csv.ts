// scripts/generate-mock-shopee-csv.ts
import * as fs from 'fs';
import * as path from 'path';

const headers = [
  'ID do Pedido',
  'ID do Produto',
  'Nome do Produto',
  'Data do Pedido',
  'Status do Pedido',
  'Valor do Pedido',
  'Comissao Estimada',
  'Comissao Real',
  'Sub ID'
];

const mockData = [
  ['240419ABC123', '111222', 'Fone de Ouvido Premium X', '2024-04-19 14:30:00', 'Completed', 'R$ 150,00', 'R$ 10,50', 'R$ 10,50', 'CAMP_01'],
  ['240419ABC123', '333444', 'Cabo USB-C Reforçado', '2024-04-19 14:30:00', 'Completed', 'R$ 45,00', 'R$ 3,15', 'R$ 3,15', 'CAMP_01'],
  ['240420XYZ987', '555666', 'Webcam 4K Ultra', '2024-04-20 09:15:00', 'Pending', 'R$ 450,00', 'R$ 31,50', 'R$ 0,00', 'CAMP_02'],
  ['240420DEF456', '777888', 'Mouse Gamer Pro', '2024-04-20 11:00:00', 'Cancelled', 'R$ 220,00', 'R$ 15,40', 'R$ 0,00', 'CAMP_01']
];

const csvContent = [
  headers.join(';'),
  ...mockData.map(row => row.join(';'))
].join('\n');

const outputPath = path.join(process.cwd(), 'shopee_mock_report.csv');
fs.writeFileSync(outputPath, csvContent);

console.log(`✅ Sucesso! Arquivo gerado em: ${outputPath}`);
console.log('---');
console.log('Dica: Use este arquivo no Drawer de Importação para testar a lógica de Item ID e Fingerprint.');
