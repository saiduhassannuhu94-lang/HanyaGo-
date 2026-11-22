# HanyaGo Public Ticket Verification Audit

Date: 2026-11-22
Scope: Read-only inspection of live booking schema, SQL functions, triggers, and ticket UI. No database writes.

## Ticket-code issuance: generator confirmed

Live evidence:
- `public.bookings.public_ticket_code` is `NOT NULL` and has a column default:
  `upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20))`.
- This produces a 20-character uppercase hexadecimal code (approximately 80 bits of randomness). A unique index is present.
- `reserve_scheduled_seats` omits `public_ticket_code` from its INSERT, correctly allowing the database default to generate it.
- `get_my_scheduled_ticket` returns the code for the authenticated passenger/super-admin.
- `travel-ticket.html` only creates a QR code for paid + confirmed tickets and encodes the public verifier URL with the ticket code.
- `public-ticket-verify.html` calls `verify_public_scheduled_ticket` and displays the verifier response.

**Correction:** The earlier suspicion that ticket codes were missing was incorrect. The live database default fills codes on booking insert. The QR path is connected at source level. No end-to-end booking or QR scan/verification was performed, so runtime behavior remains untested.

## Security/quality considerations

- The current code is 80-bit rather than the preferred 128-bit (or greater) entropy for a long-lived public bearer identifier. The unique index protects against duplicates, but a collision would fail the booking insert rather than retry automatically. This is not evidence that codes are practically guessable; 80 bits makes random guessing very unlikely.
- The verification page calls the Supabase RPC directly from the browser, and the live function is executable by `anon`. No HanyaGo-specific rate limiter or abuse-control layer was identified in this client path or the SQL function. Supabase/provider-level quotas are not the same as per-ticket throttling.
- Public verification returns route, departure, seat numbers, fare, operator, vehicle and vehicle-registration details. No passenger name or phone was observed in the payload. The verification page itself does not display vehicle registration, but the RPC payload includes it; minimize returned fields to only what is necessary.
- Authenticated `get_my_scheduled_ticket` returns passenger and booking contact fields/payment reference. Its function checks access for the owning passenger or super-admin.

## Repository/live-schema drift

- The current live database contains `private.enforce_approved_identity_before_booking()`, a BEFORE INSERT trigger on `public.bookings`. When `auth.uid()` is not null, it checks `private.hanyago_identity_requirements_met(auth.uid())` and raises an error if approval requirements are not met.
- The helper checks passenger/driver/operator identity-document approvals, with an admin bypass. Trigger/helper behavior was inspected but not runtime-tested with role-specific accounts.
- The repository's migration list does not include the live trigger/helper definitions. A drafted reservation-RPC replacement was retired because the live trigger already provides the identity check; it was redundant and not a suitable migration-history fix. Migration/live-schema parity still needs a reviewed reconciliation.

## Recommended architecture for public verification abuse controls

- Remove direct anonymous execution of the verifier RPC only after a server-side replacement is ready and tested, so users are not left with broken QR verification.
- Route public verification through a Supabase Edge Function that applies request throttling and abuse monitoring before calling the database.
- Rate-limit by source IP and/or a privacy-preserving hashed ticket-code key, with stricter controls for repeated invalid codes. Avoid logging raw ticket codes or passenger data.
- Keep response payload minimized, uniform for invalid codes, and avoid unnecessary vehicle-registration exposure.
- Ensure valid QR tickets still work and that fallback verification instructions are available before rollout.

## Next actions

1. Prepare a no-production-change Edge Function/rate-limit design and test plan for the public verifier.
2. Consider strengthening code entropy to 128-bit random opaque codes and collision handling, only after a migration plan and tests.
3. Test complete booking-to-ticket path in a safe test environment: reservation generates code; confirmed QR resolves; paid/confirmed verifies; unpaid/cancelled rejected; malformed/random codes fail safely.
4. Restore migration-history parity for the identity trigger/helper; inspect dependencies, grants, and schema drift before preparing a corrected migration.
5. Do not modify production SQL or deploy without a reviewed diff, test plan, rollback plan, and owner approval.

Status: Ticket-code generation confirmed at database-source level; verifier/UI source paths confirmed; public verification RPC is directly callable by anon and no app-specific rate limiter was identified; end-to-end behavior not tested. No live changes performed.
