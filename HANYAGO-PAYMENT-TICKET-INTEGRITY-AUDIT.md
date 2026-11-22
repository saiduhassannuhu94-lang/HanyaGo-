# HanyaGo Payment-to-Ticket Integrity Audit

Review date: 2026-11-22
Scope: Read-only inspection of active Paystack Edge Function source and live SQL function definitions. No production changes.

## Finding — Payment success is recorded before seat confirmation recovery is guaranteed

The active `paystack-webhook` version 6:
- Validates the provider signature using HMAC SHA-512.
- Verifies payment reference, amount, currency, and successful transaction status.
- Records payment status as `success` before calling `confirm_paid_booking`.
- If confirmation throws, returns HTTP 500 so provider retries may occur.
- If confirmation returns false, it records `seat_confirmation_conflict` in provider_response and returns HTTP 200 with `ticket_confirmed: false`.

The active `paystack-checkout` version 7 verification action also records the verified payment status and calls `confirm_paid_booking`; if the function returns false, it responds that payment is verified but the seat could not be confirmed and tells the passenger to contact support and not pay again.

Live `confirm_paid_booking` locks the booking, rejects missing/cancelled bookings, locks seats assigned to the booking, counts seats in `held` or `booked` status, requires that count to equal passenger_count, then marks those seats booked and the booking confirmed. It does not check hold expiry itself. Therefore, a late successful payment after seat-release can fail confirmation, while a seat still marked held despite an elapsed timestamp may be confirmed by the function unless another process has released it. This is a race/recovery risk, not proof of an actual failed payment.

## Recommended follow-up
1. Design a payment reconciliation/recovery state that is durable and visible to admins.
2. Never tell a passenger to pay again when a successful provider payment exists.
3. Add automated handling or an explicit admin queue for `payment_success_ticket_conflict`, including refund or alternate-seat resolution.
4. Add tests for webhook/callback races, duplicate success, expired hold, released seats, confirmation RPC exception, and retries.
5. Inspect `extend_scheduled_booking_hold` and `release_scheduled_booking_hold` authorization/grants before altering.
6. Confirm function execution grants and role checks before changes.

No migration, Edge Function deployment, payment, or database write was performed during this audit.
