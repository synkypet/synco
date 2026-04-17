import { waitUntil } from '@vercel/functions';

export interface TriggerOptions {
  requestId?: string;
  baseUrl?: string;
  host?: string;
  shouldAwait?: boolean;
  source?: 'manual' | 'heartbeat' | 'auto-nudge' | 'autoretrigger' | 'cronjob' | 'github';
  depth?: number;
}

/**
 * Aciona o worker de processamento de fila.
 * @param options Configurações de disparo
 * @returns true se o disparo foi realizado (ou aceito), false em caso de erro crítico
 */
export async function triggerWorker(options: TriggerOptions = {}): Promise<boolean> {
  const { requestId, baseUrl, host, shouldAwait, source = 'manual', depth = 0 } = options;
  const rid = requestId || Math.random().toString(36).substring(7);

  // --- RESOLUÇÃO DE URL CENTRALIZADA (FRENTE 3) ---
  const vercelEnv = process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV;
  const officialAppUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  
  let finalBaseUrl = '';

  if (vercelEnv === 'production') {
    // 1. Prioridade absoluta para Produção: URL oficial configurada
    finalBaseUrl = officialAppUrl || '';
  } else if (vercelEnv === 'preview') {
    // 2. Prioridade para Preview: Host da requisição atual ou VERCEL_URL da branch
    finalBaseUrl = baseUrl || (host ? `${host.includes('localhost') ? 'http' : 'https'}://${host}` : '') || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  }

  // 3. Fallback final (Localhost ou variáveis persistentes)
  if (!finalBaseUrl) {
    if (baseUrl) {
      finalBaseUrl = baseUrl;
    } else if (host) {
      const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
      finalBaseUrl = `${protocol}://${host}`;
    } else if (officialAppUrl) {
      finalBaseUrl = officialAppUrl;
    } else if (process.env.VERCEL_URL) {
      finalBaseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      finalBaseUrl = 'http://localhost:3000';
    }
  }

  const workerUrl = `${finalBaseUrl}/api/send-jobs/process`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout para o disparo/handshake inicial

  console.log(`[WORKER-TRIGGER] [${rid}] [SOURCE:${source.toUpperCase()}] Acionando worker em ${workerUrl} (await: ${!!shouldAwait})...`);

  try {
    const fetchPromise = fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': process.env.CRON_SECRET || '',
        'x-request-id': rid,
        'x-worker-depth': String(depth)
      },
      signal: controller.signal
    });

    if (shouldAwait) {
      const res = await fetchPromise;
      clearTimeout(timeoutId);
      console.log(`[WORKER-TRIGGER] [${rid}] [SOURCE:${source.toUpperCase()}] Trigger finalizado com aguardo (Status: ${res.status})`);
      return res.ok;
    } else {
      // Disparo em Background (Serverless-Safe via waitUntil se disponível)
      try {
        // waitUntil garante que o ambiente serverless (Vercel) não mate a execução antes do fetch completar
        waitUntil(
          fetchPromise
            .then(res => {
              clearTimeout(timeoutId);
              if (!res.ok) console.warn(`[WORKER-TRIGGER] [${rid}] [SOURCE:${source.toUpperCase()}] Worker respondeu com erro: ${res.status}`);
            })
            .catch(err => {
              clearTimeout(timeoutId);
              if (err.name === 'AbortError') {
                console.error(`[WORKER-TRIGGER-TIMEOUT] [${rid}] [SOURCE:${source.toUpperCase()}] Timeout no disparo do worker (8s).`);
              } else {
                console.error(`[WORKER-TRIGGER-ERROR] [${rid}] [SOURCE:${source.toUpperCase()}] Falha no background:`, err.message);
              }
            })
        );
      } catch (waitError) {
        // Fallback caso waitUntil não esteja disponível (ambiente não-Vercel dev)
        fetchPromise.catch(err => console.error(`[WORKER-TRIGGER-FALLBACK-ERROR] [${rid}] [SOURCE:${source.toUpperCase()}]`, err.message));
      }
      return true; // Retornamos true pois o disparo foi iniciado
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error(`[WORKER-TRIGGER-ERROR] [${rid}] [SOURCE:${source.toUpperCase()}] Erro crítico no utilitário de disparo:`, error.message);
    return false;
  }
}
