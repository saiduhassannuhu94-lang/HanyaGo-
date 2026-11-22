# HanyaGo Payment Recovery — Test Matrix

Status: Proposed tests; **not yet executed against a staging/live payment environment**.
Date: 2026-11-22
No payments, refunds, or production writes were performed while drafting this matrix.

## Goal
Prevent duplicate charges and ensure every verified successful payment ends in exactly one of:
- valid confirmed ticket/seats, or
- a visible, actionable recovery case for operations (refund or alternate transport resolution after verification).

## Cases

| ID | Scenario | Expected result | Test status |
|---|---|---|---|
| PR-01 | Successful payment, all seats still held and hold unexpired | Booking confirmed; seats booked; no recovery flag | Not run |
| PR-02 | Duplicate successful webhook | Idempotent; no duplicate ticket/booking or second payment record | Not run |
| PR-03 | Webhook and callback verification race | Safe, idempotent final state | Not run |
| PR-04 | Payment succeeds after seats released | Payment retained as success; ticket not fabricated; recovery case visible; passenger told not to pay again | Not run |
| PR-05 | Seat hold expired but row still says held | Confirmation must enforce actual expiry or atomically validate payment/hold policy | Not run |
| PR-06 | Confirmation RPC throws after payment verified | Provider retry and reconciliation preserve payment success; visible recovery case; no duplicate charge | Not run |
| PR-07 | Passenger callback verification repeats | No repeated charge; returns truthful payment/ticket state | Not run |
| PR-08 | Amount or currency mismatch in webhook | Reject event; do not confirm booking | Not run |
| PR-09 | Invalid webhook signature | Reject; no database changes | Not run |
| PR-10 | Unknown provider reference | Reject and alert/log appropriately | Not run |
| PR-11 | Passenger attempts to view another user's payment reference | Denied; passenger ownership enforced | Not run |
| PR-12 | Admin opens recovery queue | Only authorized staff can see; sensitive fields minimized | Not run |
| PR-13 | Admin retries confirmation | Server rechecks seats, booking state, authorization; audit entry; idempotent | Not run |
| PR-14 | Admin records manual refund | Requires verified provider refund result, not arbitrary status toggle; immutable audit record | Not run |
| PR-15 | Recovery case remains unresolved | Queue persists and clearly displays age/priority | Not run |

## Exit criteria before production changes

- Exact active function definitions reviewed and changes diffed.
- Tests run in isolated environment with non-production Paystack credentials/test transactions.
- Database race/idempotency tests pass.
- Admin recovery queue access control and audit logging pass.
- Refund reconciliation tested end-to-end.
- Rollback plan reviewed.
- Owner approval before production apply/deploy.

