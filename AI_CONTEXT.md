# SYNCO — Contexto Atual (Sprint Focus)

Este arquivo descreve o estado imediato do projeto e os focos de curto prazo.
Para histórico completo, regras de design ou protocolo de IA, consulte os arquivos específicos.

---

## Estado Atual

O sistema está **operacional em produção** (`synco.pro`).

O pipeline completo funciona end-to-end:
- Link Shopee → Resolve → Reafilia → Enriquece → Campanha → Jobs → Worker → Wasender → WhatsApp

Blockers de qualidade implementados:
- Guardião no processor (bloqueia itens inválidos antes de criar campanha)
- Classificação antecipada de offer_type (cupons e carrinhos não passam como produto)
- Worker estável: deadline 45s, anti-loop, pacing, locks de canal

---

## Foco da Sprint Atual

### PromoMetadata Stage 2
- Persistência de cupons em `campaign_items`
- Card de preview no Envio Rápido
- Template de mensagem com seção de cupom

---

## Referências Primárias

- **GEMINI.md**: Design System (Identidade Visual)
- **AGENTS.md**: Regras de Desenvolvimento e Protocolo IA
- **WORK_LOG.md**: Histórico Completo e Roadmap
- **architecture_coupon_offers.md**: Arquitetura de cupons e PromoMetadata
- **certification_report.md**: Pacote de estabilização mergeado

---

*Este arquivo deve ser mantido enxuto, refletindo apenas a sprint atual.*