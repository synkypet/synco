# Conformidade da Integração Meta API

Este documento detalha o uso da Meta Graph API no projeto SYNCO e SYNCO Metrics, reafirmando nosso compromisso com as políticas de plataforma e os Padrões de Publicidade.

## 1. Escopo e Finalidade

O aplicativo SYNCO Metrics tem finalidade estritamente **analítica**. O objetivo é ler métricas de campanhas (Spend, Leads, Impressões, Cliques) e compará-las de forma visual com o crescimento líquido das comunidades gerenciadas pelo sistema.

O aplicativo **NÃO**:
- Cria, edita ou exclui anúncios, conjuntos de anúncios ou campanhas;
- Ativa ou pausa campanhas;
- Cria, edita ou compartilha Públicos Customizados (Custom Audiences);
- Realiza engajamento falso, simulação de clique ou interações automatizadas de usuário.

## 2. Permissões Solicitadas

O sistema solicita exclusivamente permissões de leitura. Nenhuma permissão de gerenciamento é exigida.

- `ads_read`: Para consultar insights e listar campanhas.
- `public_profile`: Padrão do token para identificar o usuário conectado.

**Nota técnica:** A permissão `ads_management` NÃO deve ser solicitada no painel "Meta for Developers", pois não fazemos nenhum tipo de alteração em campanhas.

## 3. Endpoints Utilizados

O backend utiliza o Client HTTP nativo do Node.js (`fetch()`) para consumir os endpoints oficiais da Meta. **Todos os acessos usam exclusivamente o método GET.**

Não existem métodos POST, PATCH, PUT ou DELETE em nosso código direcionados à Meta.

Endpoints atuais:
- `GET /v19.0/me?fields=id,name` (Validação)
- `GET /v19.0/{ad_account_id}?fields=name,account_status,currency...`
- `GET /v19.0/{pixel_id}?fields=name,creation_time...`
- `GET /v19.0/{ad_account_id}/campaigns`
- `GET /v19.0/{ad_account_id}/insights`
- `GET /v19.0/{campaign_id}/insights`

## 4. Segurança, Rate Limit e Cache

Para evitar sobrecarga na API da Meta e impedir que o nosso sistema seja sinalizado como ferramenta de *scraping*:
1. **Cache (In-Memory)**: Respostas de listagem e insights são cacheadas em memória por 5 minutos (`CACHE_TTL = 300000 ms`). Múltiplos acessos no painel no mesmo intervalo são servidos via cache sem onerar a Meta.
2. **Rate Limit**: Temos um controle interno no backend (`MAX_CALLS_PER_MINUTE`) que bloqueia acessos excessivos do mesmo usuário à Meta API dentro de um minuto, prevenindo floods provocados por reloads manuais ou bugs de interface.
3. **Autenticação Header**: O token de acesso (`access_token`) agora é passado via cabeçalho `Authorization: Bearer <TOKEN>` nas requisições seguras `fetchMetaWithCacheAndLimit`, removendo-o da query string por motivos de conformidade estendida de infraestrutura.
