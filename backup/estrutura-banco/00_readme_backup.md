# SYNCO — Backup Estrutural (Manual)

Este diretório contém um pacote de backup estrutural do banco de dados PostgreSQL (Supabase).
**IMPORTANTE**: Este NÃO é um dump oficial recuperável automaticamente. É um conjunto de scripts e documentação para reconstrução manual da arquitetura do sistema em caso de necessidade.

## Objetivo
O objetivo deste pacote é permitir que um desenvolvedor consiga subir uma estrutura idêntica do SYNCO do zero, garantindo que tabelas, colunas, relacionamentos e lógicas de banco (triggers/funções) sejam replicadas corretamente.

## Organização do Pacote

### 1. Arquivos Parciais (Baseados em Migrations)
Estes arquivos foram gerados automaticamente a partir das migrations do projeto, mas podem exigir revisão se houver alterações manuais feitas diretamente no Dashboard do Supabase.
- `01_schema_context.sql`: Contém as definições de `CREATE TABLE` das entidades principais.

### 2. Snapshots Estruturais (Estado Atual - JSON)
Estes arquivos foram preenchidos com exportações reais do Supabase (Snapshot). Eles fornecem a referência exata das configurações de produção:
- `03_policies.sql`: Políticas de RLS exportadas.
- `04_functions.sql`: Definições de funções e lógicas de banco.
- `05_triggers.sql`: Gatilhos de automação vinculados.
- `06_indexes.sql`: Mapeamento de todos os índices de performance.
- `07_extensions.sql`: Lista de extensões ativas e versões.

### 3. Documentação e Contexto
- `02_tables_notes.md`: Resumo funcional revisado de TODAS as tabelas do sistema.

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
