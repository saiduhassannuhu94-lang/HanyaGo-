# HanyaGo Intercity Booking Engine — Source Audit (2026-11-22)

## Scope
Reviewed the repository source for `intercity.js`, `intercity-admin.js`, `admin.js`, and the initial migration `supabase/migrations/202610200001_initial_schema.sql`. This is a source-only audit. Live Supabase function bodies, database policies, constraints, and production deployment were not independently inspected because access to live management APIs is not currently verified.

## What is confirmed in the frontend
- The passenger UI calls `search_scheduled_departures`, `get_scheduled_departure_seats`, and `reserve_scheduled_seats` RPCs.
- The passenger flow caps selection at 8 seats and disables payment after its client-side hold countdown reaches zero.
- Checkout calls the `paystack-checkout` Edge Function and expects an authorization URL.
- Admin seat blocking/reopening calls `staff_set_scheduled_seat_status`.
- The operations UI publishes departures by a direct table update to `scheduled_departures` setting `status='published'` and `operator_verified=true`; the UI checks admin role and asks for a note/confirmation.
- The initial schema migration contains profiles, bookings, payments and RLS policies, but it does not define the scheduled departures, seat inventory, seat reservation RPCs, or hold lifecycle in the reviewed migration. Other migrations or live SQL may define these; they were not verified.

## Critical verification requirements (not claims that bugs exist)
1. **Atomic reservation:** `reserve_scheduled_seats` must lock/claim every requested seat within one transaction, and roll back the whole request if any seat is unavailable. Two simultaneous requests for the same seat must never both succeed.
2. **Server-side limits and inputs:** enforce passenger count/seat cap (maximum 8), seat-number validity, departure status, booking cutoff, account/identity eligibility, and fare calculation in the database or trusted server, not only in JavaScript.
3. **Hold expiry:** the server must treat expired holds as expired even if the client timer is altered or payment is started from another tab/device. Expired holds should release inventory consistently.
4. **Payment verification:** checkout must only charge a server-computed amount and a booking in a valid held state. Webhook must verify provider signature, amount, currency, reference, booking association and idempotency; browser redirect alone must not mark paid or issue a ticket.
5. **Seat-state transitions:** staff RPC must validate allowed transitions, prevent staff from blocking booked seats, and preserve booking/payment history. Frontend disabling is not authorization.
6. **Departure publication:** direct updates to published status must be constrained by RLS/DB checks so only admins can publish, with required evidence and validated company/vehicle/departure data. Operators must not be able to publish their own schedule.
7. **Company scope:** operator access must be checked against active company membership and the company/vehicle/departure relationship in the database, not only the UI's company dropdown.
8. **Cancellation and refunds:** departure cancellation must be a workflow that identifies affected bookings and payment/refund state, not merely a schedule status update.
9. **Concurrency and abuse tests:** add integration tests for same-seat races, multi-seat partial failure, expired holds, duplicate webhook deliveries, altered payment amount, unauthorized operator actions, and cancellation with paid tickets.

## Immediate next work
Obtain or inspect the SQL definitions for the scheduled-departure tables and the RPCs listed above. Do not write/apply a speculative migration against an unconfirmed schema. When definitions are available, review them, propose a minimal corrective migration, and test it against a disposable Supabase database before any production application.

## Status
- Frontend call paths inspected: source confirmed.
- Critical backend guarantees: unverified.
- Production booking safety: not yet proven.
- Live DB changes: none performed by this audit.
