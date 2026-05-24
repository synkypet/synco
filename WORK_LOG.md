# SYNCO — Work Log

## Purpose
This file is the operational memory of the project.
Use it to track completed blocks, known debt, active risks, and the next execution steps.

---

## Completed Blocks

- BLOCO A — Base visual and navigation performance fixes
- BLOCO B — Global visual refinement
- BLOCO C — Radar refinement
- BLOCO D — Robustness and auth cleanup
- BLOCO E — Radar Base44 layout restoration
- BLOCO F — Standalone Quick Send flow
- BLOCO G — Login aligned with Modern Skeuo
- BLOCO H — Operational pipeline (Shopee adapter, Wasender lifecycle, session-based queue, worker stabilization) ✅ COMPLETE
  - H1: Shopee real adapter — resolução, retry, reafiliação ✅
  - H2: Affiliate settings per user ✅
  - H3: Wasender session lifecycle integration ✅
  - H4: Session-based queue, pacing, retry, cooldown, deadline ✅
- BLOCO I — Mercado Livre adapter e OpenGraph Catalog Fallback ✅
  - I1: Correção de canonical URL de produtos ML para evitar 404 e viabilizar scraper fallback ✅
  - I2: Enriquecimento de metadados ML usando URL original rica + scrapers reordenados com timeout curto ✅
  - I3: Correção do blocker de multiusuário: fallback de conexão robusto (effectiveConnection) com userId autêntico do Supabase, aplicado exclusivamente para o Mercado Livre, possibilitando a geração de meli.la para usuários que possuem apenas a extensão pareada (sem registro explícito em user_marketplaces). ✅

---

## Infrastructure and Deploy

- Vercel production deploy on `synco.pro` — active
- ESLint conflict resolved by pinning ESLint 8.57.1
- `npm install`, `npm run build`, and `npx tsc --noEmit` passing 100%
- Production branch flow via merge to `main`

---

## Current Architecture — Operational State

- Shopee first marketplace — LIVE
- WasenderAPI as WhatsApp transport — LIVE
- Queue per phone/session — LIVE
- Affiliate configuration per user — LIVE
- Worker with 45s deadline, anti-loop (3 retrigger limit), channel locks — LIVE
- Offer classification: `product_offer`, `coupon_offer`, `product_with_coupon` — LIVE
- Cupom early-stop blocking — LIVE
- Mercado Livre (com OpenGraph fallback para links de catálogo) — LIVE
- PromoMetadata persistence — PLANNED (architecture defined in architecture_coupon_offers.md)
- Payments — PENDING (after operational flow is fully stable)

---

## Known Technical Debt

- `PromoMetadata` persistence in `campaign_items` not yet implemented (schema defined)
- Receipts retention cleanup — minimal but still pending
- Monitor Wasender avg response latency in production
- Verify if 3-retrigger limit is sufficient at scale

---

## Known Risks

- Wasender session instability must still be handled explicitly (lifecycle integrated but external dependency)
- Shopee affiliate flow may depend on external constraints
- Retrigger depth limit (3) needs monitoring under high volume

---

## Next Steps

1. PromoMetadata persistence — Stage 2 of architecture_coupon_offers.md
2. Payments after operational flow is fully validated at scale

---

## Update rule

Whenever a meaningful block is completed:
- append what changed
- note blockers
- note remaining risks
- update next steps