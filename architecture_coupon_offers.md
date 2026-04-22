# Arquitetura: Tratamento de Cupons e Ofertas Condicionadas (SYNCO)

Este documento define a estrutura técnica e as regras de negócio para a identificação, classificação e futura persistência de cupons e produtos com benefício condicionado no sistema SYNCO.

## 1. Classificação (OfferType)
O sistema utiliza o campo `offer_type` como eixo central para definir o fluxo de cada entrada:

*   **`product_offer`**: Produto comum com preço factual (comportamento padrão).
*   **`coupon_offer`**: Cupom puro (sem produto específico associado ou com card de produto incompleto).
*   **`product_with_coupon`**: Produto real vinculado a um benefício condicionado (ex: "Preço X apenas com cupom Y").

## 2. Estrutura de Dados (Stage 2)
A camada promocional deve viver **fora** do objeto `factual`, garantindo que cupons não sejam confundidos com dados factuais provenientes de APIs de marketplace.

### PromoMetadata
```typescript
interface PromoMetadata {
  coupon_code?: string;
  discount_text?: string;
  condition_text?: string;
  redemption_url?: string;
  expiry_date?: string;
  instructions?: string;
  verification_status: 'unverified' | 'text_extracted' | 'manually_informed' | 'verified';
}
```

## 3. Regras de Ouro (Guardrails)
Para preservar a integridade operacional e a confiança do usuário final:

1.  **Isolamento Factual**: Cupons **nunca** alteram o campo `factual.price`.
2.  **Exibição Separada**: Cupons não entram no campo `🔥 Por`. Eles devem ser exibidos como uma camada adicional de informação.
3.  **Proibição de Cálculo**: É proibido calcular ou exibir "Preço Final Estimado" automaticamente nesta fase para evitar ambiguidades.
4.  **Coerência de Tipo**: Ofertas do tipo `product_offer` não devem carregar `promo_metadata`.

## 4. Estratégia de Persistência (Futura)
A persistência na tabela `campaign_items` será realizada através de:
*   Coluna `offer_type` (TEXT/Indexado).
*   Coluna `promo_metadata` (JSONB) para flexibilidade de payloads.

## 5. Ordem de Implementação Recomendada
1.  **Refino do Parser**: Extração de campos para `promo_metadata` via `linkProcessor`.
2.  **Persistência Mínima**: Atualização de schemas e DTOs.
3.  **UI de Preview**: Card específico para cupons no Envio Rápido.
4.  **Template de Mensagem**: Injeção da seção de cupom no WhatsApp/Telegram.

## 6. Status da Frente
*   **ETAPA 1 (Identificação e Bloqueio)**: ✅ **Implementada**.
    *   *O sistema já classifica as ofertas e bloqueia o envio automático de cupons como produtos comuns.*
*   **ETAPA 2 (Arquitetura e Contrato)**: 📋 **Planejada (Aprovada)**.
    *   *Estrutura de dados e regras de ouro definidas neste documento.*
