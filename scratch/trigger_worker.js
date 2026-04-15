const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function triggerWorker() {
  const protocol = 'http';
  const host = 'localhost:3000'; // Ajuste se necessário para o ambiente
  const url = `${protocol}://${host}/api/send-jobs/process`;
  const secret = process.env.CRON_SECRET || 'fallback_if_not_set';

  console.log(`Tentando disparar o worker em: ${url}`);
  console.log(`Usando CRON_SECRET: ${secret ? 'Configurado' : 'NÃO CONFIGURADO'}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': secret
      }
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log('Resposta do Worker:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Erro ao disparar worker:', error.message);
  }
}

triggerWorker();
