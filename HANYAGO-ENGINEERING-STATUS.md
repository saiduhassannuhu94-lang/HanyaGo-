# HanyaGo Engineering Status & Roadmap

Updated: 2026-11-22
Policy: Free infrastructure only unless owner explicitly approves a cost. Production DB and active Edge Functions must not be modified without review, test evidence, and approval.

## Current project status

### Completed investigations / artifacts
- [x] Repository roadmap and audit documents.
- [x] Static quality-check script and GitHub Actions workflow.
- [x] Booking engine and security audit.
- [x] Identity-verification gate bypass identified on scheduled seat reservation RPC.
- [x] Corrective migration drafted, committed, but **not applied**. Reconstructed SQL requires exact validation before use.
- [x] Paystack active checkout/webhook source reviewed read-only.
- [x] Payment-to-ticket integrity audit committed.
- [x] Admin payment recovery workflow audit committed.
- [x] Payment recovery test matrix drafted; tests **not run** in isolated payment environment.
- [x] Public ticket verification audit committed; missing ticket-code generation suspected from live booking path.

### Known findings, prioritized
1. **P0/P1 review gate — Identity gate bypass.** SECURITY DEFINER reservation RPC lacks explicit identity helper check. Validate corrective migration exact diff, then test before production apply.
2. **P1 — Public ticket-code issuance.** Live reservation RPC omits ticket code, no column default or trigger found, but public verifier depends on ticket code. Trace any other code paths; likely missing generator.
3. **P1 — Paid-but-unconfirmed recovery.** Successful Paystack payment can be recorded even if seat confirmation fails; recovery queue/refund resolution not demonstrated.
4. **P1/P2 — Public ticket verification protection.** Review rate limiting/brute-force risk; public verifier returns operator and vehicle registration details.
5. **P2 — Admin payment visibility.** Payment conflict markers aren't loaded/displayed; fixed 100-payment cap without paging/filter; stale “Paystack integration pending” label needs configuration/readiness validation.
6. **P2 — Payment/seat race tests.** Webhook/callback duplication, late payments after seat release, hold expiry, confirmation retries.
7. **P2 — Advisor hygiene.** Review auth leaked-password protection, missing FK indexes, RLS auth-initplan and permissive-policy warnings. Avoid dropping unused indexes without evidence.

## Next work sequence (no cost)
1. Confirm the ticket-code issue by tracing every code generation path and app ticket rendering.
2. Design the secure ticket-code generation fix and tests; do not apply.
3. Validate identity-gate migration against the exact live RPC definition (diff, signature, behavior), then add/test fixtures. No staging branch because it is billable.
4. Design payment-recovery case model and admin workflow; document actions, permissions, audit log and idempotency.
5. Review public ticket-verification brute-force mitigation and privacy/data minimization.
6. Review remaining security/performance advisor items.
7. Consolidate all test evidence and prepare a release-readiness checklist.

## Change discipline
- Read-only live inspection unless explicitly agreed.
- No paid staging/branch or plan upgrade without explicit consent.
- No fake/demo records.
- No production migration/deployment without preflight diff, test plan, rollback plan, and owner approval.
- Report completed work separately from proposed work and tests not executed.
