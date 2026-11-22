# HanyaGo Engineering Status & Roadmap

Updated: 2026-11-22
Policy: Free infrastructure only unless owner explicitly approves a cost. Production DB and active Edge Functions must not be modified without review, test evidence, and approval.

## Current project status

### Completed investigations / artifacts
- [x] Repository roadmap, audit documents, static quality-check script, and GitHub Actions workflow.
- [x] Booking engine and security review.
- [x] Live identity enforcement inspected: scheduled booking RPC is SECURITY DEFINER, but a BEFORE INSERT trigger calls `private.enforce_approved_identity_before_booking()`, which checks `private.hanyago_identity_requirements_met(auth.uid())` when auth.uid is present. The helper checks approved proof for passengers/drivers/operators; admin bypass is intentional. No runtime tests with role-specific accounts yet.
- [x] Paystack active checkout/webhook source reviewed read-only.
- [x] Payment-to-ticket integrity and admin payment recovery audits committed.
- [x] Payment recovery test matrix drafted; tests not run in isolated payment environment.
- [x] Ticket-code generation confirmed: `public_ticket_code` is NOT NULL with a DB default derived from `gen_random_uuid()`; reservation RPC omits the field and database fills it. Ticket UI creates QR for paid/confirmed bookings. End-to-end QR validation remains untested.

### Known findings, prioritized
1. **P1 — Migration/live-schema drift.** Live identity trigger/helper exist but repository migrations do not contain their definitions. The drafted reservation-RPC replacement migration is redundant with the currently observed trigger and is not approved to apply; retire or supersede it with a reviewed migration that captures the live intended architecture.
2. **P1 — Paid-but-unconfirmed payment recovery.** Successful Paystack payment can be recorded even if seat confirmation fails; recovery/refund resolution not demonstrated.
3. **P1/P2 — Public ticket verification protection.** Public verifier is an unauthenticated lookup by ticket code; inspect rate limiting/enumeration defenses. Codes currently have about 80-bit entropy (20 hex characters); consider strengthening to 128 bits.
4. **P2 — Admin payment visibility.** Conflict markers aren't loaded/displayed; payment list is capped at 100 without paging/filter; stale “Paystack integration pending” label needs readiness validation.
5. **P2 — Payment/seat race tests.** Webhook/callback duplication, late payment after seat release, hold expiry, confirmation retries.
6. **P2 — Advisor hygiene.** Review leaked-password protection, missing FK indexes, RLS auth-initplan and permissive-policy warnings. Avoid dropping unused indexes without evidence.

## Next work sequence (no cost)
1. Reconcile repository migration history with the live identity trigger/helper, and safely retire the redundant RPC migration draft.
2. Review public ticket verification anti-enumeration/rate-limiting posture and ticket-code entropy.
3. Validate payment recovery path and design an admin recovery workflow; production remains unchanged.
4. Test identity enforcement with role-specific cases in a safe environment, without creating paid staging.
5. Review remaining security/performance advisor items.
6. Consolidate evidence and prepare a release-readiness checklist.

## Change discipline
- Read-only live inspection unless explicitly agreed.
- No paid staging/branch or plan upgrade without explicit consent.
- No fake/demo records.
- No production migration/deployment without preflight diff, test plan, rollback plan, and owner approval.
- Report completed work separately from proposed work and tests not executed.
