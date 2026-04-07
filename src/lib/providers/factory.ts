// src/lib/providers/factory.ts
// Factory centralizada — único ponto de decisão sobre qual provider usar.

import { ChannelProvider } from './types';
import { TelegramProvider } from './telegram.provider';
import { WhatsAppProvider } from './whatsapp.provider';

const providerCache: Record<string, ChannelProvider> = {};

/**
 * Retorna a instância do provider correto para o tipo de canal.
 * Usa cache para evitar re-instanciar a cada job.
 */
export function getProvider(channelType: string): ChannelProvider {
  if (providerCache[channelType]) {
    return providerCache[channelType];
  }

  let provider: ChannelProvider;

  switch (channelType) {
    case 'telegram':
      provider = new TelegramProvider();
      break;
    case 'whatsapp':
      provider = new WhatsAppProvider();
      break;
    default:
      throw new Error(`[ProviderFactory] Canal desconhecido: "${channelType}". Providers disponíveis: whatsapp, telegram.`);
  }

  providerCache[channelType] = provider;
  return provider;
}
