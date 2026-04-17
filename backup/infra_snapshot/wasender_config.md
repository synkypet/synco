# Wasender — Snapshot de Configuração Operacional

Este documento mapeia as configurações manuais feitas no Dashboard da Wasender necessárias para o funcionamento do SYNCO.

## Credenciais (Secrets)
- **Origem**: Salvas nas variáveis de ambiente da Vercel (`WASENDER_PAT`).
- **Recuperação**: Copiar o "Personal Access Token" gerado no Dashboard da Wasender e atualizar na Vercel.

## Configuração de Instância/Canal
- **Tipo**: WhatsApp Business / Personal.
- **Pareamento**: Realizado via leitura de QR Code no Dashboard da Wasender ou via dialog de conexão no Dashboard do SYNCO.
- **Persistência**: O `sessionId` é salvo na tabela `public.channels` do Supabase.

## Webhooks
- **URL de Webhook**: `https://[DOMÍNIO_PRODUÇÃO]/api/webhooks/wasender`
- **Webhook Secret**: Salvo na Vercel (`WASENDER_WEBHOOK_SECRET`). Deve ser configurado no Dashboard da Wasender para validar os payloads enviados.
- **Eventos Monitorados**:
  - `message_received` (Ingestão de links)
  - `session_status_changed` (Monitoramento de estado)

## Procedimento de Restore
1. Acessar Wasender Dashboard.
2. Gerar novo PAT se o anterior for perdido.
3. Configurar a URL de Webhook apontando para o novo deploy.
4. Ler o QR Code para reativar as sessões se os tokens de sessão expirarem.
