/**
 * Utilitário compartilhado para acionamento do worker de envio (queue processor).
 * Centraliza o disparo do "Fast-Trigger" para evitar duplicidade e facilitar manutenção.
 */

export interface TriggerOptions {
  requestId?: string;
  baseUrl?: string;
  host?: string;
}

export async function triggerWorker(options: TriggerOptions = {}) {
  const { requestId, baseUrl, host } = options;
  const rid = requestId || Math.random().toString(36).substring(7);
  
  // No ambiente operacional, o baseUrl deve ser preferencialmente o host local ou domínio atual
  // Se não fornecido, tenta derivar do host ou do ambiente
  let finalBaseUrl = baseUrl;
  
  if (!finalBaseUrl) {
    if (host) {
      const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
      finalBaseUrl = `${protocol}://${host}`;
    } else {
      finalBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    }
  }

  const workerUrl = `${finalBaseUrl}/api/send-jobs/process`;

  console.log(`[WORKER-TRIGGER] [${rid}] Acionando worker em ${workerUrl}...`);

  try {
    // Disparo Fire-and-Forget
    // Usamos fetch mas encapsulamos em um contexto que não bloqueia o fluxo principal
    fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': process.env.CRON_SECRET || '',
        'x-request-id': rid
      }
    }).catch(err => {
      console.error(`[WORKER-TRIGGER-ERROR] [${rid}] Falha no disparo do worker:`, err.message);
    });
    
    return true;
  } catch (error: any) {
    console.error(`[WORKER-TRIGGER-ERROR] [${rid}] Erro crítico no utilitário de disparo:`, error.message);
    return false;
  }
}
