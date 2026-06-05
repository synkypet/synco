// Simple in-memory cache and rate limiter for Meta API calls
// Helps prevent scraping flags and quota issues

interface CacheEntry {
  data: any;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const metaCache = new Map<string, CacheEntry>();

const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_CALLS_PER_MINUTE = 20;

export async function fetchMetaWithCacheAndLimit(url: string, token: string, userId: string) {
  // 1. Rate Limiting Check
  const now = Date.now();
  const userCalls = rateLimitMap.get(userId) || [];
  const recentCalls = userCalls.filter(ts => now - ts < RATE_LIMIT_WINDOW);
  
  if (recentCalls.length >= MAX_CALLS_PER_MINUTE) {
    throw new Error('META_RATE_LIMIT_EXCEEDED');
  }
  
  recentCalls.push(now);
  rateLimitMap.set(userId, recentCalls);

  // 2. Cache Check (Strip token from URL if it's there to avoid storing tokens in keys, but we pass it as header anyway)
  // We remove the query string entirely if it contains access_token, but it shouldn't anymore.
  const urlObj = new URL(url);
  urlObj.searchParams.delete('access_token');
  const cacheKey = `${userId}:${urlObj.toString()}`;

  const cached = metaCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    console.log(`[META CACHE HIT] ${urlObj.pathname}`);
    return cached.data;
  }

  // 3. Fetch
  const response = await fetch(urlObj.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();

  // If there's an error, don't cache
  if (!response.ok || data.error) {
    return data; 
  }

  // 4. Set Cache
  metaCache.set(cacheKey, {
    data,
    timestamp: now
  });

  return data;
}
