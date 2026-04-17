# GitHub Actions — Snapshot de Configuração CI/CD

Este documento mapeia as chaves necessárias para o funcionamento dos workflows de automação no GitHub.

## Workflows Ativos
- **SYNCO Queue Pump** (`.github/workflows/queue-pump.yml`): Responsável por manter o batimento da fila via cron.

## Secrets do Repositório (Obrigatório)
Estes nomes devem ser configurados em *Settings > Secrets and variables > Actions > Repository secrets*:

| Nome da Secret | Finalidade | Local de Uso |
| :--- | :--- | :--- |
| `VERCEL_APP_URL` | URL base do deploy de produção para acionamento do heartbeat. | `queue-pump.yml` |
| `CRON_SECRET` | Token de segurança que deve coincidir com a env da Vercel para autorizar o worker. | `queue-pump.yml` |

## Variáveis do Repositório (Variables)
Nenhuma variável global (Variables) identificada nos workflows atuais.

## Procedimento de Restore
1. Acessar o repositório no GitHub.
2. Navegar até `Settings` > `Secrets and variables` > `Actions`.
3. Criar as secrets listadas acima com os valores recuperados do seu gerenciador de senhas ou da configuração da Vercel.
4. Habilitar o workflow `SYNCO Queue Pump` se ele estiver pausado (clicando em `Actions` > `Enable workflow`).
