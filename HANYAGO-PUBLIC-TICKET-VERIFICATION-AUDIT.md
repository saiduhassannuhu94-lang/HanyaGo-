# HanyaGo Public Ticket Verification Audit

Date: 2026-11-22
Scope: Read-only inspection of live booking schema, SQL functions, triggers, and ticket UI. No database writes.

## Ticket-code issuance: generator EXISTS; prior finding corrected

Live evidence:
- `public.bookings.public_ticket_code` is `NOT NULL` and has a column default:
  `upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20))`.
- This creates a 20-character uppercase hexadecimal ticket code from the first 20 hex characters of a UUID (approximately 80 bits of randomness). A unique index is present.
- `reserve_scheduled_seats` omits `public_ticket_code` from its INSERT, correctly allowing the database default to generate the code.
- `get_my_scheduled_ticket` returns the code for the authenticated passenger/super-admin.
- `travel-ticket.html` only creates a QR code for paid + confirmed tickets and encodes the public verifier URL with the ticket code.
- `public-ticket-verify.html` calls `verify_public_scheduled_ticket` and displays the verification result.

**Correction:** The earlier suspicion that ticket codes were missing was incorrect. The live database default fills codes on booking insert. The UI path is connected as expected at source level. No end-to-end live booking was performed, so actual QR scan/verification remains untested.

## Security/quality considerations

- The code is 80-bit rather than the preferred 128-bit (or greater) entropy for a long-lived public bearer identifier. The unique index protects against duplicate codes, but a collision would fail the booking insert rather than retry automatically.
- Public verification is an unauthenticated lookup by ticket code. Rate limiting / anti-enumeration protection should be reviewed at the API, Edge Function, or other enforcement layer before operational launch.
- Public verification payload is relatively minimal with respect to passenger privacy: no passenger name or phone was observed in the return payload. It does include route, departure, seat numbers, fare, operator, and vehicle/registration details. Confirm which vehicle/operator fields are necessary for validation and minimize exposure where possible.
- The authenticated `get_my_scheduled_ticket` returns passenger and booking contact fields/payment reference, but the inspected function restricts retrieval to the owning passenger or super-admin.

## Next actions

1. Verify the public verifier function's authorization/grants, rate limiting, and enumeration defenses. SQL function itself does not show application-level throttling.
2. Consider improving code entropy (e.g., server-generated 128-bit random opaque codes) while retaining collision-safe handling, only after a migration plan and tests.
3. Test the complete booking-to-ticket path in a safe test environment: reservation insert generates code; confirmed ticket QR URL resolves; paid/confirmed ticket verifies; unpaid/cancelled tickets are rejected; malformed/random codes return safely.
4. Do not modify production SQL or deploy without a reviewed diff, test plan, rollback plan, and owner approval.

Status: Generator confirmed at source/database level. End-to-end behavior not yet tested. No live changes were performed.
