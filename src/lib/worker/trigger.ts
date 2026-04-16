import { waitUntil } from '@vercel/functions';

/**
 * Utilitário compartilhado para acionamento do worker de envio (queue processor).
 * Centraliza o disparo do "Fast-Trigger" para evitar duplicidade e facilitar manutenção.
 */

export interface TriggerOptions {
  requestId?: string;
  baseUrl?: string;
  host?: string;
  shouldAwait?: boolean;
}

/**
 * Aciona o worker de processamento de fila.
 * @param options Configurações de disparo
 * @returns true se o disparo foi realizado (ou aceito), false em caso de erro crítico
 */
export async function triggerWorker(options: TriggerOptions = {}): Promise<boolean> {
  const { requestId, baseUrl, host, shouldAwait } = options;
  const rid = requestId || Math.random().toString(36).substring(7);
  
  // Resolução de URL com prioridade:
  let finalBaseUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  
  if (!finalBaseUrl) {
    if (host) {
      const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
      finalBaseUrl = `${protocol}://${host}`;
    } else if (process.env.VERCEL_URL) {
      finalBaseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      finalBaseUrl = 'http://localhost:3000';
    }
  }

  const workerUrl = `${finalBaseUrl}/api/send-jobs/process`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout para o disparo em si

  console.log(`[WORKER-TRIGGER] [${rid}] Acionando worker em ${workerUrl} (await: ${!!shouldAwait})...`);

  try {
    const fetchPromise = fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': process.env.CRON_SECRET || '',
        'x-request-id': rid
      },
      signal: controller.signal
    });

    if (shouldAwait) {
      const res = await fetchPromise;
      clearTimeout(timeoutId);
      console.log(`[WORKER-TRIGGER] [${rid}] Trigger finalizado com aguardo (Status: ${res.status})`);
      return res.ok;
    } else {
      // Disparo em Background (Serverless-Safe via waitUntil se disponível)
      try {
        // waitUntil garante que o ambiente serverless (Vercel) não mate a execução antes do fetch completar
        waitUntil(
          fetchPromise
            .then(res => {
              clearTimeout(timeoutId);
              if (!res.ok) console.warn(`[WORKER-TRIGGER] [${rid}] Worker respondeu com erro: ${res.status}`);
            })
            .catch(err => {
              clearTimeout(timeoutId);
              if (err.name === 'AbortError') {
                console.error(`[WORKER-TRIGGER-TIMEOUT] [${rid}] Timeout no disparo do worker (8s).`);
              } else {
                console.error(`[WORKER-TRIGGER-ERROR] [${rid}] Falha no background:`, err.message);
              }
            })
        );
      } catch (waitError) {
        // Fallback caso waitUntil não esteja disponível (ambiente não-Vercel dev)
        fetchPromise.catch(err => console.error(`[WORKER-TRIGGER-FALLBACK-ERROR] [${rid}]`, err.message));
      }
      return true; // Retornamos true pois o disparo foi iniciado
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error(`[WORKER-TRIGGER-ERROR] [${rid}] Erro crítico no utilitário de disparo:`, error.message);
    return false;
  }
}
