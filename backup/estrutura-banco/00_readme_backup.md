# SYNCO — Backup Estrutural (Manual)

Este diretório contém um pacote de backup estrutural do banco de dados PostgreSQL (Supabase).
**IMPORTANTE**: Este NÃO é um dump oficial recuperável automaticamente. É um conjunto de scripts e documentação para reconstrução manual da arquitetura do sistema em caso de necessidade.

## Objetivo
O objetivo deste pacote é permitir que um desenvolvedor consiga subir uma estrutura idêntica do SYNCO do zero, garantindo que tabelas, colunas, relacionamentos e lógicas de banco (triggers/funções) sejam replicadas corretamente.

## Organização do Pacote

### 1. Arquivos Parciais (Baseados em Migrations)
Estes arquivos foram gerados automaticamente a partir das migrations do projeto, mas podem exigir revisão se houver alterações manuais feitas diretamente no Dashboard do Supabase.
- `01_schema_context.sql`: Contém as definições de `CREATE TABLE` das entidades principais.

### 2. Documentação Estrutural
- `02_tables_notes.md`: Resumo funcional das tabelas para facilitar o entendimento da arquitetura.

### 3. Arquivos Manuais (Dependem do Usuário)
Estes arquivos são placeholders. Você deve copiar o conteúdo correspondente do **Supabase SQL Editor** ou **Database Settings** para completá-los:
- `03_policies.sql`: Políticas de Row Level Security (RLS).
- `04_functions.sql`: Funções PostgreSQL e RPCs.
- `05_triggers.sql`: Gatilhos de automação (ex: sync de webhooks).
- `06_indexes.sql`: Índices de performance.
- `07_extensions.sql`: Extensões necessárias (ex: `uuid-ossp`, `pg_net`).

## Como usar este backup
Para recriar o banco:
1. Comece habilitando as extensões (`07_extensions.sql`).
2. Execute a criação das tabelas (`01_schema_context.sql`).
3. Adicione as funções e RPCs (`04_functions.sql`).
4. Habilite os triggers (`05_triggers.sql`).
5. Configure as políticas de RLS (`03_policies.sql`).
6. Crie os índices de performance (`06_indexes.sql`).

---
*Este backup foi gerado em 16/04/2026.*
