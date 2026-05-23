import { buildAffiliateUrl } from '../url-utils';
import { MercadoLivreAdapter } from '../../MercadoLivreAdapter';
import { validateEligibility, FactualData } from '../../../linkProcessor';
import { UserMarketplaceConnection } from '@/types/marketplace';

describe('Mercado Livre url-utils e Gaps de Afiliação', () => {
  const canonicalUrl = 'https://www.mercadolivre.com.br/p/MLB123456';

  it('1. buildAffiliateUrl com connection undefined -> deve retornar null', () => {
    expect(buildAffiliateUrl(canonicalUrl)).toBeNull();
  });

  it('2. buildAffiliateUrl com ml_partner_id ausente -> deve retornar null', () => {
    const connection = {
      ml_matt_tool: '12345'
    } as UserMarketplaceConnection;
    expect(buildAffiliateUrl(canonicalUrl, connection)).toBeNull();
  });

  it('3. buildAffiliateUrl com ml_matt_tool ausente -> deve retornar null', () => {
    const connection = {
      ml_partner_id: '67890'
    } as UserMarketplaceConnection;
    expect(buildAffiliateUrl(canonicalUrl, connection)).toBeNull();
  });

  it('4. buildAffiliateUrl com credenciais válidas -> deve retornar URL com matt_tool e partner_id', () => {
    const connection = {
      ml_matt_tool: '12345',
      ml_partner_id: '67890'
    } as UserMarketplaceConnection;
    const result = buildAffiliateUrl(canonicalUrl, connection);
    expect(result).not.toBeNull();
    expect(result).toContain('matt_tool=12345');
    expect(result).toContain('partner_id=67890');
  });

  it('5. buildAffiliateUrl retorno nunca deve ser igual à canonicalUrl', () => {
    const connection = {
      ml_matt_tool: '12345',
      ml_partner_id: '67890'
    } as UserMarketplaceConnection;
    const result = buildAffiliateUrl(canonicalUrl, connection);
    expect(result).not.toBe(canonicalUrl);
  });

  it('6. MercadoLivreAdapter sem connection -> reaffiliation_status deve ser "blocked"', async () => {
    const adapter = new MercadoLivreAdapter();
    const result = await adapter.preProcessIncomingLink(canonicalUrl, undefined);
    expect(result.reaffiliation_status).toBe('blocked');
    expect(result.generated_affiliate_url).toBeUndefined();
  });

  // TODO: Teste 7 usa status 'canonicalized' como trigger, mas o adapter ML
  // nunca emite esse status (emite 'blocked' ou 'reaffiliated').
  // O guard cobre corretamente, mas o cenário do teste é hipotético.
  it('7. validateEligibility com status "canonicalized" e marketplace "Mercado Livre" -> ineligible', () => {
    const factual = {
      marketplace: 'Mercado Livre',
      title: 'Produto',
      price: 100,
      image: 'http://img.com/1.jpg',
      canonical_url: canonicalUrl,
      reaffiliation_status: 'canonicalized',
      finalLinkToSend: canonicalUrl + '?matt_tool=1&partner_id=1',
      eligibility: { isEligible: true, status: 'eligible', reasons: [], offer_type: 'product_offer' }
    } as unknown as FactualData;

    const eligibility = validateEligibility(factual);
    expect(eligibility.status).toBe('ineligible');
    expect(eligibility.isEligible).toBe(false);
    expect(eligibility.reasons).toContain('Afiliação inválida: link do Mercado Livre sem parâmetros de rastreio');
  });

  it('8. validateEligibility com finalLinkToSend === canonical_url e marketplace "Mercado Livre" -> ineligible', () => {
    const factual = {
      marketplace: 'Mercado Livre',
      title: 'Produto',
      price: 100,
      image: 'http://img.com/1.jpg',
      canonical_url: canonicalUrl,
      reaffiliation_status: 'reaffiliated',
      finalLinkToSend: canonicalUrl, // Identical to canonical
      eligibility: { isEligible: true, status: 'eligible', reasons: [], offer_type: 'product_offer' }
    } as unknown as FactualData;

    const eligibility = validateEligibility(factual);
    expect(eligibility.status).toBe('ineligible');
    expect(eligibility.isEligible).toBe(false);
    expect(eligibility.reasons).toContain('Afiliação inválida: link final idêntico ao canônico');
  });
});
