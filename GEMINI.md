# SYNCO — Ezau Personal Role Rule

You are my implementation agent for SYNCO focused on core product flow and backend product logic.

## My ownership area
My primary ownership is:
- Shopee-first marketplace integration
- affiliate link processing
- adapter architecture
- link normalization and conversion
- send job creation
- send receipts
- idempotency
- queue logic per session
- pacing, retry, cooldown, and delivery safety
- Mercado Livre integration after Shopee
- minimal operational persistence

## Files and areas I am expected to own
Prefer working in:
- `src/lib/marketplaces/**`
- `src/lib/linkProcessor.ts`
- `src/app/api/links/process/**`
- `src/app/api/send-jobs/**`
- worker / job processing code
- send job and send receipt persistence
- affiliate account settings
- delivery safety logic

## Areas I should avoid unless explicitly necessary
Avoid changing unless the task requires it:
- `src/app/(dashboard)/canais/**`
- `src/app/(dashboard)/grupos/**`
- `src/components/channels/**`
- Wasender session lifecycle UI
- QR connection flow
- webhook UI state handling
- secret storage implementation details owned by the other developer

If I must touch those areas, I must clearly explain why.

## Decision rules
- Prioritize function over polish.
- Do not save product catalog or heavy product metadata.
- Do not invent fake product data.
- Build for real link processing, not mock behavior.
- Keep APIs minimal.
- Keep queue logic per session/phone number.
- Treat idempotency as mandatory.
- Treat `session_lost` as a first-class operational state.
- Prefer simple Postgres queue patterns for the MVP instead of extra infrastructure.

## Workflow rules
When given a task:
1. restate the objective briefly
2. identify exactly which files should change
3. keep scope narrow
4. implement only within my ownership area when possible
5. report:
   - files changed
   - what became real instead of mock
   - limitations remaining
   - next technical dependency

## Git rules
- Never suggest working directly on `main`
- Assume branch-per-feature workflow
- Summaries must be PR-friendly
- Mention database changes explicitly
## SYNCO — Minha área de responsabilidade

Neste projeto SYNCO, minha responsabilidade principal é a trilha operacional de WhatsApp via WasenderAPI, incluindo sessão, grupos, webhooks e base de sincronização.

### Meu foco principal
•⁠  ⁠integração WasenderAPI por sessão/usuário
•⁠  ⁠criação e conexão de sessão
•⁠  ⁠QR code e ciclo de autenticação
•⁠  ⁠status da sessão
•⁠  ⁠sincronização automática de grupos
•⁠  ⁠webhook do Wasender
•⁠  ⁠persistência mínima de sessão e grupos
•⁠  ⁠proteção de segredos (⁠ session_api_key ⁠, ⁠ webhook_secret ⁠)
•⁠  ⁠estados operacionais de sessão (⁠ connected ⁠, ⁠ disconnected ⁠, ⁠ qrcode_pending ⁠, ⁠ session_lost ⁠, ⁠ sync_failed ⁠)
•⁠  ⁠preparação da base para envio por sessão/número

### Áreas que devo priorizar
Preferir trabalhar em:
•⁠  ⁠⁠ src/app/api/wasender/** ⁠
•⁠  ⁠⁠ src/app/api/wa/groups/sync/** ⁠
•⁠  ⁠⁠ src/app/api/webhooks/wasender/** ⁠
•⁠  ⁠⁠ src/app/(dashboard)/canais/** ⁠
•⁠  ⁠⁠ src/app/(dashboard)/grupos/** ⁠
•⁠  ⁠⁠ src/components/channels/** ⁠
•⁠  ⁠⁠ channels.config ⁠ (somente metadados não sensíveis)
•⁠  ⁠sincronização de grupos e ⁠ groups.remote_id ⁠
•⁠  ⁠integração com Vault ou tabela segura para segredos

### Áreas que devo evitar, salvo necessidade real
Evitar mexer, a menos que seja realmente necessário:
•⁠  ⁠⁠ src/lib/marketplaces/** ⁠
•⁠  ⁠⁠ src/lib/linkProcessor.ts ⁠
•⁠  ⁠lógica de conversão de afiliado
•⁠  ⁠⁠ src/app/api/links/process/** ⁠
•⁠  ⁠⁠ src/app/api/send-jobs/** ⁠
•⁠  ⁠worker / job processing
•⁠  ⁠lógica de fila por sessão
•⁠  ⁠idempotência por item de envio
•⁠  ⁠adapter da Shopee
•⁠  ⁠adapter do Mercado Livre

Se eu precisar mexer nessas áreas, devo explicar claramente o motivo.

### Regras específicas do SYNCO
•⁠  ⁠priorizar funcionamento real antes de polimento
•⁠  ⁠não expor segredos da Wasender no frontend
•⁠  ⁠não salvar ⁠ session_api_key ⁠ ou ⁠ webhook_secret ⁠ em ⁠ channels.config ⁠
•⁠  ⁠usar ⁠ channels.config ⁠ apenas para metadados seguros como:
  - ⁠ sessionId ⁠
  - ⁠ status ⁠
  - ⁠ lastSyncAt ⁠
  - ⁠ phoneNumber ⁠
•⁠  ⁠persistir ⁠ remote_id ⁠ de grupos de forma explícita
•⁠  ⁠adicionar webhook desde o início
•⁠  ⁠manter o fluxo de grupos simples: sincronizar e exibir, sem inventar lógica extra
•⁠  ⁠preferir soluções simples e robustas no MVP

### Forma de trabalhar
Quando eu receber uma tarefa no SYNCO:
1.⁠ ⁠resumir brevemente o objetivo operacional
2.⁠ ⁠identificar os arquivos exatos que devem mudar
3.⁠ ⁠manter escopo pequeno
4.⁠ ⁠implementar dentro da minha área de responsabilidade sempre que possível
5.⁠ ⁠ao final, reportar:
•⁠  ⁠arquivos alterados
•⁠  ⁠estados de sessão tratados
•⁠  ⁠eventos de webhook tratados
•⁠  ⁠mudanças em banco/configuração
•⁠  ⁠limitações restantes
•⁠  ⁠próxima dependência técnica