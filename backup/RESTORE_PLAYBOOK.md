# Playbook de Reconstrução do Sistema — SYNCO

Este documento define a estratégia e os procedimentos de recuperação total do sistema SYNCO.

## 1. Ordem Exata de Restauração (Dependency Chain)

1. **Repositório**: Restaurar `synco.bundle` em um novo diretório.
2. **Ambiente (Vercel)**:
   - Importar `production.env` (salvo em `SYNCO_BACKUP_2026-04-16_21-08/vercel`).
   - Criar projeto Vercel e realizar deploy.
3. **Infra: GitHub Actions**:
   - Reconfigurar secrets mapeadas em `infra_snapshot/github_actions_config.md`.
4. **Banco (Supabase)**:
   - Criar novo projeto Supabase.
   - Habilitar extensões (`07_extensions.sql`).
   - Aplicar Schema (`01_schema_context.sql` ou migrations).
   - Opcional: Reaplicar as Políticas, Funções e Triggers (Arquivos 03 a 06 do backup estrutural).
5. **Integrações Externas**:
   - Reconfigurar webhooks no Wasender Dashboard.
   - Reconfigurar jobs no Cron-job.org.

## 2. Checklist de Disaster Recovery

- [ ] Vercel: Deploy efetuado sem erros de build.
- [ ] Supabase: Tabelas, Gatilhos e Permissões restaurados.
- [ ] Wasender: Instância com status "CONNECTED".
- [ ] Webhook: Log de recepção de eventos na Wasender indicando "200 Success".
- [ ] Cron: Primeiro acionamento processado nos logs da Vercel.

## 3. Validação Pós-Restore (Proof of Functionality)

| O que você quer provar? | Como provar (Evidência) |
| :--- | :--- |
| **Vercel voltou?** | Acessar o domínio principal e confirmar que a Dashboard carrega. |
| **Supabase voltou?** | `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';` deve listar as tabelas criadas. |
| **Webhook Wasender voltou?** | Enviar "oi" para o bot e verificar se o log de ingestão (`automation_logs`) detecta a entrada. |
| **Cron voltou?** | Verificar no Dashboard do Cron-job.org se a última execução foi bem-sucedida. |
| **Automação voltou?** | Enviar um link de produto para o grupo monitorado e aguardar a criação da campanha/job. |
| **Fila voltou?** | Inserir um job manual e verificar se o Worker (`api/send-jobs/process`) o consome. |

## 4. Arquivos de Referência (Opcionais)

O script `backup/scripts/execute_remote_dump.ps1` permanece no pacote apenas como referência técnica tática, caso o acesso ao ambiente antigo seja recuperado. Para a reconstrução atual, considere o banco como iniciando do **estado zero operacional**.
