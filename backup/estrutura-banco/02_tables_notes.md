# SYNCO — Notas de Tabelas (Arquitetura)

Este documento descreve a finalidade das principais tabelas do sistema para fins de referência e reconstrução.

## Núcleo de Usuário e Configuração
- **`profiles`**: Extensão da tabela `auth.users` do Supabase. Armazena metadados públicos do usuário (username, nome, avatar).
- **`marketplaces`**: Catálogo global de marketplaces suportados (Shopee, Mercado Livre, etc.). Contém ícones, cores e status de configuração.
- **`user_marketplaces`**: Conexões de afiliados dos usuários. Vincula um usuário a um marketplace com suas credenciais específicas (Affiliate ID, etc.).

## Canais e Distribuição
- **`channels`**: Representa uma conexão de saída (WhatsApp via Wasender ou Telegram). Armazena o tipo de canal, status e configurações de sessão (ex: `sessionId`).
- **`channel_secrets`**: Tabela de alta segurança. Armazena chaves de API e segredos de webhook de forma isolada.
- **`groups`**: Cache operacional de grupos sincronizados dos canais. Armazena `remote_id`, nome e contagem de membros.

## Automação e Fila
- **`campaigns`**: Agrupador lógico de envios. Criado automaticamente pela automação ou manualmente pelo "Envio Rápido".
- **`campaign_items`**: O conteúdo real a ser enviado (produto, link, copy, imagem).
- **`send_jobs`**: A fila de execução. Cada registro representa uma tentativa de envio de um item para um destino específico.
- **`send_receipts`**: Comprovantes de entrega. Utilizados para controle de idempotência e auditoria de envios realizados.

## Monitoramento (Sources e Routes)
- **`automation_sources`**: Grupos de origem que o sistema monitora em busca de links.
- **`automation_routes`**: Regras de roteamento. Define de qual "Source" para qual destino (Grupo ou Lista) os links devem ser encaminhados, incluindo filtros e templates.
