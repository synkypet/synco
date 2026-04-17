# Cron-job.org — Snapshot de Configuração Operacional

Este documento descreve os agendamentos externos necessários para "vencer" a fila e manter a automação do SYNCO pulsando.

## Jobs Ativos

### 1. Worker Heartbeat (Queue Pump)
- **URL**: `https://[DOMÍNIO_PRODUÇÃO]/api/send-jobs/process`
- **Método**: `POST`
- **Frequência**: 1 minuto (Ideal: a cada 30 segundos se o plano permitir).
- **Finalidade**: Acionar o worker para processar mensagens pendentes e respeitar o pacing.

### 2. Automation Nudge
- **URL**: `https://[DOMÍNIO_PRODUÇÃO]/api/automation/nudge`
- **Método**: `POST`
- **Frequência**: 1 a 5 minutos.
- **Finalidade**: Garantir que o pipeline de ingestão de links e criação de campanhas não fique estagnado.

## Autenticação
- **Headers**:
  - `Authorization`: `Bearer [CRON_SECRET]`
- **Segurança**: O `CRON_SECRET` deve ser o mesmo configurado nas variáveis de ambiente da Vercel para permitir a execução.

## Procedimento de Restore
1. Acessar [cron-job.org](https://cron-job.org).
2. Recriar os jobs apontando para as URLs do novo domínio.
3. Copiar o `CRON_SECRET` da Vercel e colar no header de Autorização de cada job.
