'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import CryptoJS from 'crypto-js';
import { ShopeeOrder, OrderStatus } from '@/types/earnings';

// Mapeamento de sinônimos para colunas do CSV da Shopee
const COLUMN_MAP: Record<string, keyof Partial<ShopeeOrder> | string> = {
  'ID do Pedido': 'order_id',
  'Order ID': 'order_id',
  'Número do pedido': 'order_id',
  
  'ID do Produto': 'product_id',
  'Product ID': 'product_id',
  
  'Nome do Produto': 'product_name',
  'Product Name': 'product_name',
  
  'Data do Pedido': 'order_time',
  'Order Time': 'order_time',
  
  'Status': 'order_status',
  'Status do Pedido': 'order_status',
  'Order Status': 'order_status',
  
  'Valor do Pedido': 'checkout_amount',
  'Order Amount': 'checkout_amount',
  'Preço do Produto': 'checkout_amount',
  
  'Comissão Estimada': 'estimated_commission',
  'Estimated Commission': 'estimated_commission',
  
  'Comissão Real': 'actual_commission',
  'Actual Commission': 'actual_commission',
  
  'Sub_ID': 'sub_id',
  'Sub ID': 'sub_id'
};

export function useShopeeParser() {
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseCSV = (file: File): Promise<Partial<ShopeeOrder>[]> => {
    return new Promise((resolve, reject) => {
      setIsParsing(true);
      setError(null);

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const data = results.data as any[];
            const normalizedOrders = data.map((row, index) => {
              const normalizedRow: any = { raw_row_json: row };
              
              // 1. Mapear colunas baseado em sinônimos
              Object.keys(row).forEach(key => {
                const cleanKey = key.trim();
                const mappedKey = COLUMN_MAP[cleanKey];
                if (mappedKey) {
                  normalizedRow[mappedKey] = row[key];
                }
              });

              // 2. Gerar Fingerprint da linha bruta (Segurança de Unicidade)
              const rawString = JSON.stringify(row);
              normalizedRow.source_row_fingerprint = CryptoJS.SHA256(rawString).toString();

              // 3. Normalizar Valores Numéricos (Trata R$, pontos de milhar e vírgulas)
              const parseNum = (val: any) => {
                if (!val) return 0;
                // Remove R$, espaços e pontos de milhar, mantém apenas a última vírgula/ponto como decimal
                const clean = String(val).replace(/[R$\s]/g, '').replace(/\.(?=\d{3,}(\,|$))/g, '').replace(',', '.');
                return parseFloat(clean) || 0;
              };

              normalizedRow.checkout_amount = parseNum(normalizedRow.checkout_amount);
              normalizedRow.estimated_commission = parseNum(normalizedRow.estimated_commission);
              normalizedRow.actual_commission = parseNum(normalizedRow.actual_commission);

              // 4. Normalizar Data (Prever formatos PT-BR e ISO)
              // TODO: Implementar parser de data mais robusto se necessário
              
              // 5. Definir external_id (Campo de Unicidade no DB)
              // Regra: source_item_id -> fingerprint
              normalizedRow.external_id = normalizedRow.source_item_id || normalizedRow.source_row_fingerprint;

              return normalizedRow;
            });

            setIsParsing(false);
            resolve(normalizedOrders);
          } catch (err: any) {
            setIsParsing(false);
            setError(`Erro ao processar dados: ${err.message}`);
            reject(err);
          }
        },
        error: (err) => {
          setIsParsing(false);
          setError(`Erro no parser: ${err.message}`);
          reject(err);
        }
      });
    });
  };

  return { parseCSV, isParsing, error };
}
