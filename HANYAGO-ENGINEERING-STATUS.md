# HanyaGo Engineering Status & Roadmap

Updated: 2026-11-22
Policy: Free infrastructure only unless owner explicitly approves a cost. Production DB and active Edge Functions must not be modified without review, test evidence, and approval.

## Current project status

### Completed investigations / artifacts
- [x] Repository roadmap, audit documents, static quality-check script, and GitHub Actions workflow.
- [x] Booking engine and security review.
- [x] Identity enforcement traced: scheduled booking RPC is SECURITY DEFINER, but BEFORE INSERT trigger calls `private.enforce_approved_identity_before_booking()`, which checks `private.hanyago_identity_requirements_met(auth.uid())` when a user is authenticated. This gate appears to be enforced by the trigger. Admin bypass is intentional in the helper. Trigger/function behavior has not been runtime-tested with user-role test accounts.
- [x] Paystack active checkout/webhook source reviewed read-only.
- [x] Payment-to-ticket integrity and admin payment recovery audits committed.
- [x] Payment recovery test matrix drafted; tests not run in isolated payment environment.
- [x] Ticket-code generator confirmed: `public_ticket_code` is NOT NULL with DB default derived from `gen_random_uuid()`; reservation RPC omits the column and relies on the default. Ticket UI creates QR for paid/confirmed bookings. End-to-end QR validation still untested.

### Known findings, prioritized
1. **P1 — Paid-but-unconfirmed payment recovery.** Successful Paystack payment can be recorded even if seat confirmation fails; recovery/refund resolution not demonstrated.
2. **P1/P2 — Public ticket verification protection.** Public verifier is an unauthenticated lookup by ticket code; inspect rate limiting/enumeration defenses. Ticket codes currently have about 80-bit entropy (20 hex characters); consider strengthening to 128 bits.
3. **P2 — Admin payment visibility.** Conflict markers aren't loaded/displayed; payment list is capped at 100 without paging/filter; stale “Paystack integration pending” label needs readiness validation.
4. **P2 — Payment/seat race tests.** Webhook/callback duplication, late payment after seat release, hold expiry, confirmation retries.
5. **P2 — Advisor hygiene.** Review leaked-password protection, missing FK indexes, RLS auth-initplan and permissive-policy warnings. Avoid dropping unused indexes without evidence.

## Next work sequence (no cost)
1. Review and document the ticket-code entropy/uniqueness and public verification rate-limit posture.
2. Validate the payment recovery path and design an admin recovery workflow; keep production unchanged.
3. Test identity enforcement via trigger/helper logic with role-specific cases; no paid staging branch.
4. Review public verification privacy and authorization.
5. Review remaining security/performance advisor items.
6. Consolidate evidence and prepare a release-readiness checklist.

## Change discipline
- Read-only live inspection unless explicitly agreed.
- No paid staging/branch or plan upgrade without explicit consent.
- No fake/demo records.
- No production migration/deployment without preflight diff, test plan, rollback plan, and owner approval.
- Report completed work separately from proposed work and tests not executed.
