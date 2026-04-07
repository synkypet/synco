# SYNCO — Protocolo de Desenvolvimento Multi-IA

Este projeto utiliza múltiplas IAs em conjunto.

## Papéis das IAs

### ChatGPT
Responsável por:
- arquitetura
- auditoria
- estratégia técnica
- organização das tarefas
- análise de respostas

### Gemini (Antigravity)
Responsável por:
- implementação no código
- refatoração
- execução de blocos
- análise direta do repositório

## Fluxo de trabalho

1. ChatGPT define o plano técnico
2. Gemini executa o plano
3. Gemini gera relatório estruturado
4. ChatGPT analisa e define o próximo bloco

## Estrutura de execução

Todo trabalho deve ser dividido em blocos:

- BLOCO A → correções críticas
- BLOCO B → refinamento estrutural
- BLOCO C → refinamento visual
- BLOCO D → robustez e performance

## Regras importantes

- Nunca executar múltiplos blocos sem aprovação
- Sempre rodar `npx tsc --noEmit`
- Nunca usar `any`
- Nunca alterar regras de negócio sem aprovação
- Manter fidelidade ao design `referencia/stitch`

## Estrutura de relatório

Todo relatório deve conter:

- Arquivos alterados
- O que mudou
- Motivo
- Impacto visual
- Impacto técnico
- Próximos passos