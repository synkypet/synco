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
  // 1. Variável de ambiente EXPLÍCITA (Produção)
  // 2. Host da requisição atual (Dinâmico)
  // 3. Vercel System URL (Fallback)
  // 4. Localhost (Ambiente de desenvolvimento)
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

  console.log(`[WORKER-TRIGGER] [${rid}] Acionando worker em ${workerUrl} (await: ${!!shouldAwait})...`);

  try {
    const promise = fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': process.env.CRON_SECRET || '',
        'x-request-id': rid
      }
    });

    if (shouldAwait) {
      const res = await promise;
      console.log(`[WORKER-TRIGGER] [${rid}] Trigger finalizado com aguardo (Status: ${res.status})`);
      return res.ok;
    } else {
      // Disparo Fire-and-Forget
      promise.catch(err => {
        console.error(`[WORKER-TRIGGER-ERROR] [${rid}] Falha no disparo do worker (background):`, err.message);
      });
      return true; // Retornamos true pois o disparo foi iniciado
    }
  } catch (error: any) {
    console.error(`[WORKER-TRIGGER-ERROR] [${rid}] Erro crítico no utilitário de disparo:`, error.message);
    return false;
  }
}
