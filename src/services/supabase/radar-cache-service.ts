// src/services/supabase/radar-cache-service.ts

interface CacheEntry {
  data: any[];
  timestamp: number;
}

/**
 * Cache em memória para resultados brutos da Shopee.
 * No MVP (sem alteração de schema), este cache é mantido enquanto a instância do worker estiver ativa.
 * Em Vercel Serverless, isso proporciona economia de API entre execuções paralelas ou próximas.
 */
class RadarCacheService {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 20 * 60 * 1000; // 20 minutos

  /**
   * Gera uma chave única para a combinação de busca.
   */
  private generateKey(keyword: string, sortType: number, listType: number, page: number): string {
    return `${keyword.toLowerCase().trim()}:${sortType}:${listType}:${page}`;
  }

  /**
   * Recupera dados do cache se válidos.
   */
  get(keyword: string, sortType: number, listType: number, page: number): any[] | null {
    const key = this.generateKey(keyword, sortType, listType, page);
    const entry = this.cache.get(key);

    if (entry && Date.now() - entry.timestamp < this.TTL_MS) {
      return entry.data;
    }

    if (entry) {
      this.cache.delete(key);
    }

    return null;
  }

  /**
   * Armazena dados no cache.
   */
  set(keyword: string, sortType: number, listType: number, page: number, data: any[]): void {
    const key = this.generateKey(keyword, sortType, listType, page);
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Remove entradas do cache para um keyword específico.
   */
  clearKeyword(keyword: string): void {
    const term = keyword.toLowerCase().trim();
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(`${term}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Retorna o número atual de entradas no cache.
   */
  getSize(): number {
    return this.cache.size;
  }

  /**
   * Limpa entradas expiradas.
   */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.TTL_MS) {
        this.cache.delete(key);
      }
    }
  }
}

export const radarCacheService = new RadarCacheService();
