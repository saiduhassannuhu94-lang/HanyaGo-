# HanyaGo Booking Security Review — Findings and Next Action
Review date: 2026-11-22
Scope: source files only; live database access was denied.

## Finding 1 — The client countdown is not a hold-security control (High, backend verification required)
File: `intercity.js`, `setHoldTimer()`, `reserveSeats()`, `payNow()`
The UI displays a 15-minute countdown and disables the Pay button when the local timer expires. Client-side time is not authoritative: it can be modified, bypassed, or run in another tab/device. The server checkout and reservation functions must enforce expiry against a database timestamp and reject expired holds.

## Finding 2 — Publish action writes directly to the table from the browser (High, RLS verification required)
File: `intercity-admin.js`, `departureAction()`
The publish flow performs a direct Supabase table update on `scheduled_departures`, setting `status='published'` and `operator_verified=true`. The UI checks the local profile role and asks for a confirmation, but these checks are bypassable. Database RLS/constraints/triggers must guarantee only authorized admins can publish, and validate required schedule/company/vehicle details. Prefer a dedicated server-side RPC that records the verifier and audit trail atomically.

## Finding 3 — Frontend seat selection limits are not security (Backend verification required)
File: `intercity.js`, `toggleSeat()`, `reserveSeats()`
The UI caps selection at eight seats. The RPC must independently validate the cap, seat numbers, departure state, cutoff, identity/access, fare and inventory.

## Finding 4 — Staff seat status changes use a server RPC (Positive design, authorization unverified)
File: `intercity-admin.js`, `seatAction()`
The client calls `staff_set_scheduled_seat_status`. The RPC must enforce staff authorization and transition rules server-side, including refusing booked/held seats when appropriate.

## Finding 5 — Booking and ticket issuance depend on server result (Positive design, payment verification unverified)
File: `intercity.js`, `reserveSeats()`, `payNow()`
The client expects a reservation RPC result with a booking ID and hold expiry and invokes a server-side Paystack checkout function. The reservation/payment functions and webhook must be tested end-to-end before production readiness.

## Live project access status
Attempts to list Supabase migrations and Edge Functions or query the database catalog returned permission denied (MCP error -32600). No live data was changed. Repository search did not find the reservation function source in the checked-in code.

## Priority next actions
1. Obtain read access to Supabase project `wtcheskbfahqpvnhyoyb` or export relevant migration/function definitions from the project owner.
2. Review definitions of `reserve_scheduled_seats`, `get_scheduled_departure_seats`, `search_scheduled_departures`, `staff_set_scheduled_seat_status`, payment checkout/webhook, and all relevant RLS policies.
3. Build a disposable test environment with a copy of schema and test users; run concurrency tests with simultaneous seat requests and payment idempotency tests.
4. Implement minimal tested changes, then deploy with explicit rollback instructions. Do not touch production DB until the target schema, backup, and authorization are confirmed.

## Status
Source audit findings are documented. Live backend remains unverified. This report is not a claim that the backend is vulnerable; it identifies protections that cannot be proven from frontend source.
