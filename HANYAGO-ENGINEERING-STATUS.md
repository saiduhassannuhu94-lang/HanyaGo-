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
- [x] Corrected ticket-code audit; confirmed public verifier is directly callable by anon, and no HanyaGo-specific limiter was identified in the client/RPC path.
- [x] Public ticket abuse/privacy review documented: RPC explicitly grants anon execute, is SECURITY DEFINER, response exposes unused vehicle registration and distinct invalid responses, no app-level throttle found in inspected sources; no exploit or live traffic testing.
- [x] Retired the redundant reservation-RPC identity migration draft and its misleading static checker.
- [x] Focused identity migration-history reconciliation audit documented: one tracked initial migration; live trigger/helper absent from migration history; relevant live trigger, helper, RLS checks, ownership/security settings and grants recorded. Full schema diff remains outstanding.
- [x] Live schema reconciliation phase 1: 18 public tables, 15 not represented in the tracked initial migration; broad catalog counts and RLS posture recorded. Full object-level diff remains outstanding.
- [x] Scheduled-departures ACL review: confirmed anon/authenticated broad table grants including TRUNCATE; confirmed broad default table ACLs for postgres and supabase_admin in public; reviewed RLS policies and intercity-admin direct table operations. Proposed least-privilege SQL documented but **not applied**. No destructive test or exploit demonstrated.

### Known findings, prioritized
1. **P1 — Scheduled-departures ACL/default privileges.** Live table grants anon and authenticated TRUNCATE and other unnecessary privileges. TRUNCATE bypasses RLS. Broad default table ACLs also exist for postgres and supabase_admin in public. Practical remote exploitability is not demonstrated. Proposed remediation is documented and awaiting owner approval.
2. **P1 — Migration/live-schema drift.** Focused identity drift is confirmed and documented. Live public schema has 18 tables while the single tracked initial migration defines only 3 core tables; 15 live tables are absent from that migration. Full columns, constraints, indexes, functions, triggers, policies, grants and ownership comparison is not complete; fresh environments may not reproduce current production behavior.
3. **P1 — Paid-but-unconfirmed payment recovery.** Successful Paystack payment can be recorded even if seat confirmation fails; recovery/refund resolution not demonstrated.
4. **P1/P2 — Public ticket verification abuse/privacy.** The verifier is directly callable by anon and no app-specific throttling was identified. Returned payload includes seat/route/fare/operator/vehicle/registration. Codes have ~80-bit entropy; guessing is unlikely, but rate limits and payload minimization still matter.
5. **P2 — Admin payment visibility.** Conflict markers aren't loaded/displayed; payment list is capped at 100 without paging/filter; stale “Paystack integration pending” label needs readiness validation.
6. **P2 — Payment/seat race tests.** Webhook/callback duplication, late payments after seat release, hold expiry, confirmation retries.
7. **P2 — Advisor hygiene.** Review leaked-password protection, missing FK indexes, RLS auth-initplan and permissive-policy warnings. Avoid dropping unused indexes without evidence.

## Next work sequence (no cost)
1. Complete owner review of [scheduled-departures ACL remediation](HANYAGO-SCHEDULED-DEPARTURES-ACL-REMEDIATION-REVIEW.md). Do not apply the candidate SQL until approved. If approved, use a controlled change window, verify effective privileges, and run role-specific smoke tests.
2. Continue full live schema/migration reconciliation and produce a reproducible baseline. Do not create a corrective migration until the full diff is reviewed.
3. Design a no-production-change public verifier gateway with throttling, uniform invalid responses, and minimal payload; preserve existing verification until replacement is tested. See [public ticket abuse/privacy review](HANYAGO-PUBLIC-TICKET-ABUSE-PRIVACY-REVIEW.md).
4. Validate payment recovery path and design an admin recovery workflow; production remains unchanged.
5. Test identity enforcement with role-specific cases in a safe environment, without creating paid staging.
6. Review remaining security/performance advisor items.
7. Consolidate evidence and prepare a release-readiness checklist.

## Change discipline
- Read-only live inspection unless explicitly agreed.
- No paid staging/branch or plan upgrade without explicit consent.
- No fake/demo records.
- No production migration/deployment without preflight diff, test plan, rollback plan, and owner approval.
- Report completed work separately from proposed work and tests not executed.
