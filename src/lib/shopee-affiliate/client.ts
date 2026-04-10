import { generateShopeeSignature } from './signature';
import { ShopeeClientConfig, ShopeeGraphQLResponse, ProductNode } from './types';

/**
 * Cliente da Open API de Afiliados da Shopee via GraphQL.
 * Executado puramente Server-Side.
 */
export class ShopeeAffiliateClient {
  private appId: string;
  private secret: string;
  private apiUrl = 'https://open-api.affiliate.shopee.com.br/graphql';

  constructor(config?: ShopeeClientConfig) {
    this.appId = config?.appId || process.env.SHOPEE_APP_ID || '';
    this.secret = config?.secret || process.env.SHOPEE_APP_SECRET || '';
  }

  /**
   * Busca produtos via GraphQL (productOfferV2).
   * Suporta busca por keyword ou IDs exatos.
   */
  async searchProducts({
    keyword,
    shopId,
    itemId,
    limit = 10,
    sortType = 1,
    listType = 0,
    page = 1
  }: {
    keyword?: string;
    shopId?: string | number;
    itemId?: string | number;
    limit?: number;
    sortType?: number;
    listType?: number;
    page?: number;
  }): Promise<ProductNode[]> {
    if (!this.appId || !this.secret) {
      throw new Error('Shopee Open API credentials not configured');
    }

    const payloadObj = {
      query: `
        query productOfferV2($keyword: String, $shopId: Int64, $itemId: Int64, $limit: Int, $sortType: Int, $listType: Int, $page: Int) {
          productOfferV2(keyword: $keyword, shopId: $shopId, itemId: $itemId, limit: $limit, sortType: $sortType, listType: $listType, page: $page) {
            nodes {
              productName
              imageUrl
              price
              priceMin
              priceMax
              commission
              commissionRate
              sellerCommissionRate
              shopeeCommissionRate
              priceDiscountRate
              itemId
              shopId
              shopName
              productCatIds
              productLink
              offerLink
            }
          }
        }
      `,
      variables: {
        keyword: keyword || undefined,
        shopId: shopId ? String(shopId) : undefined,
        itemId: itemId ? String(itemId) : undefined,
        limit,
        sortType,
        listType,
        page
      }
    };

    // Compactação total e assinatura rigorosa
    const payload = JSON.stringify(payloadObj, null, 0);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = generateShopeeSignature(this.appId, timestamp, payload, this.secret);
    
    const authHeader = `SHA256 Credential=${this.appId},Timestamp=${timestamp},Signature=${signature}`;

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: payload
      });
      
      if (!response.ok) {
        throw new Error(`[HTTP ${response.status}] ${response.statusText}`);
      }

      const json = await response.json() as ShopeeGraphQLResponse<{ productOfferV2: { nodes: ProductNode[] } }>;
      
      if (json.errors && json.errors.length > 0) {
        // Se houver erro de campo ausente, tentamos processar o que veio em data se existir
        if (!json.data || !json.data.productOfferV2) {
          throw new Error(json.errors[0].message);
        }
      }

      return json.data?.productOfferV2?.nodes || [];
    } catch (error: any) {
      throw new Error(`Shopee GraphQL Error: ${error.message}`);
    }
  }

  /**
   * Gera um Short Link de Afiliado.
   */
  async generateShortLink(originUrl: string): Promise<string> {
    if (!this.appId || !this.secret) {
      throw new Error('Shopee Open API credentials not configured');
    }

    const payloadObj = {
      query: `
        mutation GenerateShortLink($input: ShortLinkInput!) {
          generateShortLink(input: $input) {
            shortLink
          }
        }
      `,
      variables: {
        input: {
          originUrl
        }
      }
    };

    const payload = JSON.stringify(payloadObj, null, 0);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = generateShopeeSignature(this.appId, timestamp, payload, this.secret);
    const authHeader = `SHA256 Credential=${this.appId},Timestamp=${timestamp},Signature=${signature}`;

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: payload
      });

      if (!response.ok) {
        throw new Error(`[HTTP ${response.status}] ${response.statusText}`);
      }

      const json = await response.json() as ShopeeGraphQLResponse<{ generateShortLink: { shortLink: string } }>;
      
      if (json.errors && json.errors.length > 0) {
        throw new Error(json.errors[0].message);
      }

      return json.data?.generateShortLink?.shortLink || originUrl;
    } catch (error: any) {
      throw new Error(`Shopee ShortLink Error: ${error.message}`);
    }
  }
}
