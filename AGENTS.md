# SYNCO — Shared Project Rules

## Product mission
SYNCO is an operational SaaS for affiliate link processing and controlled WhatsApp distribution.

Core priorities, in order:
1. Make the system function end-to-end as fast as possible
2. Avoid rework and architecture drift
3. Keep the database lean
4. Preserve user safety, isolation, and delivery reliability
5. Add polish only after the operational flow works

## Non-negotiable architecture
- Shopee is the first real marketplace integration.
- Mercado Livre is the second marketplace integration.
- WasenderAPI is the WhatsApp transport layer.
- Each user uses their own affiliate configuration.
- Each user uses their own WhatsApp session/number.
- Queueing is per session/phone number, never global for all users.
- The system controls pacing, retry, cooldown, and limits.
- Users do not control fine-grained send timing.
- Do not store product catalog, product snapshots, or heavy product payloads in the database.
- Persist only minimal operational data.

## Persistence rules
Allowed to persist:
- user settings
- affiliate account settings
- channel/session metadata
- synced groups
- send jobs
- minimal send receipts
- short-lived operational states

Forbidden to persist unless explicitly approved:
- product catalog
- product images
- product price history
- full product payloads
- large raw metadata blobs

## Security rules
- Never expose Wasender secrets or session keys to the frontend.
- Backend manages all credentials (Zero-User-Auth).
- Prefer Supabase Vault for secrets. If not possible, use a dedicated secrets table with strict RLS or a secure isolated structure.
- Validate webhook signatures/secrets from Wasender in the `POST /api/webhooks/wasender` route.
- Never hardcode credentials, secrets, tokens, or test keys.

## Delivery rules
- Every send item must have an idempotency key.
- Retry must happen per item, not per entire job.
- The worker must check session state before each send.
- If the session is lost, the job must move to `session_lost` and pause.
- Jobs and receipts must remain lightweight.
- Receipts must have short retention and automatic cleanup.

## API surface rules for MVP
Prefer the minimum API surface needed for the MVP.

Allowed initial routes:
- POST /api/links/process
- POST /api/send-jobs
- GET /api/send-jobs/:id
- POST /api/wa/groups/sync
- POST /api/webhooks/wasender

Do not introduce extra public routes unless clearly necessary.

## Collaboration rules
- Never work directly on `main`.
- Use one branch per feature.
- Keep pull requests small and domain-specific.
- Do not edit shared core files outside your ownership scope unless necessary and explicitly noted.
- If you must touch a shared file, explain why in the summary.
- Always report:
  - files changed
  - database changes
  - API changes
  - risks
  - what still remains

## Testing and validation
Before marking a task done:
- run `npx tsc --noEmit`
- run the smallest relevant validation for the changed area
- do not claim success without verifying the changed flow

## Communication style
- Be concrete, brief, and technical.
- Do not propose broad redesigns unless asked.
- Do not expand scope.
- If blocked, explain exactly what is blocking progress.

## Documentation update rule

**Every commit to `main` that changes operational behavior must update documentation.**

This applies when:
- A block is completed or a feature goes live
- A known debt item is resolved
- Architecture decisions change
- New risks are identified or old ones resolved

Files to update per change type:
- **Feature complete / block done**: update `WORK_LOG.md` (move to Completed, remove from Next Steps) and `AI_CONTEXT.md` (update sprint focus)
- **Architecture decision**: update or create the relevant `architecture_*.md` file
- **Bug fix with systemic impact**: update `WORK_LOG.md` Known Risks section
- **New planned feature**: add to `WORK_LOG.md` Next Steps

Documentation updates must be included **in the same PR** as the code change — not in a separate commit after.

If a documentation update is not possible in the same PR (e.g. blocked by scope), note it explicitly in the PR summary under "Docs debt".