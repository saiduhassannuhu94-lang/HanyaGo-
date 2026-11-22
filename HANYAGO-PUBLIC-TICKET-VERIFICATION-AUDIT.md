# HanyaGo Public Ticket Verification Audit

Date: 2026-11-22
Scope: Read-only inspection of live SQL functions, bookings schema, triggers, and scheduled-seat reservation function. No database writes.

## High-priority finding: public ticket code generation is not visible in the live booking creation path

Observed evidence:
- `public.bookings.public_ticket_code` has a unique index.
- The live column query showed no column default.
- The live `reserve_scheduled_seats` function inserts a scheduled booking without including `public_ticket_code`.
- The only non-internal triggers on `public.bookings` are `bookings_require_approved_identity` and `bookings_set_updated_at`; neither generates ticket codes.
- Live public functions referencing `public_ticket_code` are `get_my_scheduled_ticket` and `verify_public_scheduled_ticket`; they read the code, not generate it.
- `verify_public_scheduled_ticket` searches bookings by `public_ticket_code`, and rejects codes shorter than 12 or longer than 30 characters.

Implication: Based on the live function, default, and trigger evidence, scheduled bookings created by the inspected reservation path appear likely to have a NULL ticket code. The public verification function would not find a booking with a NULL code. No scheduled departures or scheduled booking-seat records existed at the earlier read-only audit snapshot, so this is a source-level prediction, not an observed customer ticket failure.

## Related privacy observation

The public verification function returns a limited ticket verification payload: validity, ticket code, booking/payment status, seat numbers, passenger count, fare, currency, route/terminals, departure/arrival, operator and vehicle details including registration. It does not return passenger name or phone. The authenticated `get_my_scheduled_ticket` function returns more personally identifying booking fields and payment reference but scopes lookup to the signed-in passenger or super-admin.

## Recommended next actions

1. Trace the ticket issuance path and determine whether another application layer generates `public_ticket_code`; the current inspected SQL path does not.
2. Design cryptographically random ticket codes with adequate entropy and collision-safe retry (unique index exists) if generation is missing.
3. Generate ticket code in a controlled server-side transaction at reservation or confirmation time; ensure a failed insert cannot leave an inconsistent booking.
4. Test public verification: paid confirmed ticket, unpaid booking, cancelled ticket, malformed code, random code, and duplicate code collision.
5. Review public verification rate limiting / brute-force protection before enabling public QR verification.
6. Do not deploy or change production SQL until the exact correction is tested and reviewed.

Status: High priority, investigation required. No live changes were performed.
