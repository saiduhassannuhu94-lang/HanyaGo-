# HanyaGo Admin Payment Recovery Audit

Date: 2026-11-22
Scope: Read-only source review of `admin.html`, `admin.js`, live `payments` table columns, and the active Paystack payment handlers. No production data changes.

## Executive finding

The current admin operations dashboard is **not a payment-recovery console**. It shows a summary and basic payment list, but does not provide a recovery workflow for successful payments where ticket/seat confirmation fails.

## Verified gaps

1. **No conflict/recovery queue.** Admin payment query selects basic payment fields only: id, booking_id, passenger_id, provider_reference, amount_kobo, status, created_at, paid_at. It does not load or display `provider_response`, so the webhook's `seat_confirmation_conflict` marker is not visible in the dashboard.
2. **No reconciliation action.** Admin payment table has no button/action for retrying ticket confirmation, flagging a case as reviewed, resolving it with alternate seats, or recording a refund outcome.
3. **Misleading UI status.** Admin page says `Paystack integration pending`, but active Supabase Edge Functions `paystack-checkout` v7 and `paystack-webhook` v6 are present. This wording is stale and should be reconciled against the actual deployment/payment enablement status.
4. **Limited recent-record visibility.** The dashboard loads only the latest 100 payment rows and 250 booking requests; it has no pagination/search/filter for payments. A conflict could fall outside the displayed range.
5. **No automated refund evidence.** The reviewed source shows an operations follow-up message for seat confirmation conflict but no refund API or admin refund workflow. This is a source review finding, not proof that no manual refund can be performed outside HanyaGo.

## Recommended design (do not implement without separate review)

- A clearly labeled `Payment Recovery` queue driven by confirmed-success payments where ticket confirmation is not confirmed or a conflict marker exists.
- Display reference, booking, passenger, amount, paid timestamp, confirmation state, last provider verification, and safe diagnostic details.
- Actions with authorization, confirmation dialogs, immutable audit log, and idempotency: retry confirmation only after server-side validation; record manual resolution; initiate refund only after verified eligibility and provider support.
- Server-side pagination and filters (status/date/reference/booking), not loading a fixed 100 records.
- Admin never edits a payment status to manufacture a resolution. Reconcile against provider data and record the actual outcome.
- Remove or correct the stale Paystack “pending” badge only after checking actual configuration, credentials, production readiness, and whether checkout is enabled for customers.

## Next safe task

Design a recovery queue specification and test matrix first. Keep the production database and Edge Functions untouched. No paid staging environment was created.
