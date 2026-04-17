# Backup Estrutural / Reconstrução do SYNCO — Relatório de Rigor

Este documento detalha o estado de proteção do ecossistema SYNCO contra perda total de dados e infraestrutura.

## 1. Tabela de Auditoria Operacional (Nível de Desastre)

| Item | Tipo | Status | Risco | Ação Necessária | Evidência de Classificação |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Código (GitHub)** | Artefato | OK | Baixo | Versionar Bundle off-site. | `synco-2026-04-16_21-08.bundle` no disco. |
| **Ambiente (Vercel)** | Artefato | OK | Baixo | Manter backup externo do `.env`. | Arquivos `.env` de Prod/Preview/Dev salvos. |
| **Infra (Vercel)** | Artefato | OK | Baixo | Nenhuma. | `projectId` e `orgId` salvos em `project.json`. |
| **DB: Roles** | Script | **SUFICIENTE** | Baixo | Reconstruível via `01_schema_context.sql` e roles manuais. | Estrutura documentada no pacote. |
| **DB: Schema** | Script | **SUFICIENTE** | Baixo | Reconstruível via migrations e `01_schema_context.sql`. | Histórico de migrations completo no Git. |
| **DB: Dados (Data)** | **OUT-OF-SCOPE** | **NÃO PROTEGIDO** | Alto | **Dados remotos antigos perdidos.** | Sem acesso à conta/dump remoto. |
| **GitHub Actions** | Artefato | OK | Baixo | Mapear chaves na nova org/repo. | Mapeado em `infra_snapshot/github_actions_config.md`. |
| **Wasender Dashboard** | Artefato | OK | Médio | Manter chaves e webhooks documentados. | Mapeado em `infra_snapshot/wasender_config.md`. |
| **Cron-job Dashboard** | Artefato | OK | Médio | Manter agendamentos mapeados. | Mapeado em `infra_snapshot/cronjob_config.md`. |
| **Storage (Assets)** | **OUT-OF-SCOPE** | **NÃO PROTEGIDO** | Médio | **Arquivos binários antigos perdidos.** | Sem acesso à conta/export remoto. |

## 2. Diagnóstico de Gaps

- **Supabase Storage**: Auditoria de código confirmou que o projeto usa majoritariamente `imageUrl` externas (Wasender). Não foi encontrada dependência crítica de buckets (ex: `avatars` ou `products`), mas se existirem, **NÃO ESTÃO PROTEGIDOS** no backup atual.
- **Banco Remoto**: A inteligência estrutural (Migrations) está no Git, mas o **estado operacional atual** (dados do banco) só estará protegido após a execução do script de dump preparado.

## 3. Veredito Final

> [!IMPORTANT]
> **VEREDITO: PACOTE DE RECONSTRUÇÃO CONCLUÍDO.**
> Este backup é suficiente para a **reconstrução manual e técnica** do sistema em um novo ambiente. No entanto, ele **NÃO** contém os dados operacionais históricos (DML) ou arquivos binários do ambiente original por falta de acesso à conta legado.

### Situação de Recuperação:
- **O que está protegido**: Lógica de negócio, arquitetura de banco, configurações de infraestrutura e workflows de CI/CD.
- **O que NÃO está protegido**: Dados de transações passadas, filas históricas e usuários cadastrados no ambiente antigo.
- **O que foi perdido**: Dumps remotos (`data.sql`) e binários do Storage.
- **Capacidade de Manobra**: O sistema pode ser reiniciado do "zero operacional" em menos de 1 hora seguindo o Playbook.
