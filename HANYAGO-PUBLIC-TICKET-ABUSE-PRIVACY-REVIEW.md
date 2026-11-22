# HanyaGo Public Ticket Verification Abuse & Privacy Review

Date: 2026-11-22
Scope: Read-only inspection of the live verifier SQL function, ACLs, and browser verification page. No production changes, calls with ticket codes, or deployment.

## Confirmed source/live findings

### 1. Anonymous execution is explicitly granted
Live function: `public.verify_public_scheduled_ticket(p_code text)`
- `SECURITY DEFINER` is enabled.
- Owner is `postgres`.
- Function search_path is set to `public, private, pg_temp`.
- Execute ACL includes `anon`, `authenticated`, and `service_role`.
- The public verification page directly calls this RPC through the Supabase browser client using the publishable key.
- No IP-based or ticket-code-based limiter appears in the SQL function or verifier page inspected. Provider-wide limits are not evidence of ticket-specific throttling.

### 2. Response is more detailed than the UI needs
The RPC response contains:
- Ticket code and booking status.
- Latest payment status.
- Seat numbers and passenger count.
- Fare/currency.
- Route, terminals, departure and arrival.
- Operator and vehicle names.
- Vehicle registration.
- Ride type.

The public page displays a subset and omits vehicle registration, but the registration is still returned by the RPC and available to anyone calling it directly. The RPC includes ticket_code, booking_status, and payment_status in some invalid-ticket responses when a code matches a booking, while a nonexistent code gets a different not-found response. This creates a response distinction for a guessed/known code. No passenger name/phone was observed in this function response.

### 3. Code entropy and enumeration
The existing ticket code is 20 hexadecimal characters (approximately 80 bits), sourced from UUID randomness. This makes blind guessing impractical at ordinary volumes. However, the code is a bearer identifier and should still be treated as sensitive; entropy does not replace throttling, uniform errors, or minimizing payload.

### 4. Browser verifier behavior
- The page reads `code` from the URL and invokes `verify_public_scheduled_ticket` directly.
- It renders ticket code, status, route, terminal details, departure, operator, vehicle, seats, passenger count and fare for valid tickets.
- It does not display vehicle registration despite the RPC returning it.
- Browser errors are handled with a failure message; the page warns not to treat unavailable verification as proof.
- No local request throttle, retry backoff, or abuse reporting logic was found in the inspected page.

## Risk assessment

- **Moderate exposure / abuse-control gap:** Anonymous direct RPC plus no application-specific throttle creates an unprotected public lookup surface. Ticket-code entropy mitigates random enumeration substantially, so this is not characterized as a practical ticket-code guessing exploit.
- **Data minimization issue:** Vehicle registration and additional operational details are returned to public callers but are not needed by the current public page.
- **Response consistency:** Invalid matched bookings can return extra details/statuses; nonexistent codes return a different shape/message. Uniform invalid responses are preferable.
- **Operational gap:** No evidence was available from request logs/traffic analytics to quantify abuse or frequency. No active rate-limit configuration was confirmed.

## Recommended staged design (not implemented)

1. Keep the current public QR verifier working until its replacement is tested.
2. Route public verification through an Edge Function or another server-side gateway that applies throttling before database lookup. Confirm the supported rate-limiting mechanism and deployment configuration in current Supabase docs before implementation.
3. Use layered limits: source-network/IP controls (with privacy-preserving storage, such as keyed hashes rather than raw IPs where feasible) and additional throttling for repeated invalid requests. Avoid logging raw ticket codes or passenger information.
4. Return only fields necessary for ticket checking. Consider showing paid/confirmed, route, departure, seat(s), operator and vehicle label, while withholding registration and other operational fields unless the business case requires them.
5. Make every invalid, missing, cancelled, unpaid, or unconfirmed code return the same public response shape and generic message. Do not reveal that a code exists but has an invalid state.
6. Strengthen future ticket codes to at least 128 bits of cryptographically secure randomness, with collision handling, only after a migration plan and backward-compatible verification tests. Existing 80-bit codes should not be invalidated during a migration.
7. Add automated tests for valid confirmed-paid tickets, unpaid/pending, cancelled, malformed input, random nonexistent codes, matched-but-invalid bookings, repeated requests, rate-limit response, concurrency, and verifier failure.
8. Log abuse events with request IDs and aggregate counters, not ticket codes or passenger details. Add a bounded retention policy and access control to abuse logs.
9. Before rollout: review SQL/Edge Function privileges, service-role secret handling, CORS, request size and input validation, function timeout, uniform response timing as feasible, test QR scan path, rollback route, and monitoring.

## Test status and limitations

- Live function definition, ACL, and verifier source were inspected.
- No production RPC invocation with real or guessed ticket codes was performed.
- No traffic/logs, gateway limits, or deployed Edge Function configuration were inspected.
- No abuse exploit was demonstrated.
- No code, SQL, configuration, or deployment was changed.

**Status:** Public RPC access and response minimization/throttling gaps confirmed at source/config level; practical exploitability and live traffic abuse not tested.
