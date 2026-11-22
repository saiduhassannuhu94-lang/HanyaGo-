# HanyaGo Booking Security Review — Live Backend Findings

Review date: 2026-11-22
Scope: browser source, live Supabase function definitions, table metadata, grants, RLS policies, and Edge Function source. Read-only investigation only. No live database or payment changes were made.

## Confirmed Finding 1 — Scheduled-seat reservation RPC bypasses identity approval RLS gate (High priority)

**Function:** `public.reserve_scheduled_seats(...)`
- The function is `SECURITY DEFINER`, owned by `postgres`, with `search_path=public, private, pg_temp`.
- The `public.bookings` table has RLS enabled, but `FORCE ROW LEVEL SECURITY` is off and the table is owned by `postgres`.
- The bookings INSERT policy includes `private.hanyago_identity_requirements_met(auth.uid())`.
- The complete live reservation function body validates authentication, seat count (1–8), duplicate/invalid seat identifiers, passenger/contact details, booking relationship fields, profile name, departure published status, booking cutoff, and approved/active company status. It locks the departure and requested seats, checks availability, creates a pending booking, and marks the selected seats held.
- **However, the function does not call `private.hanyago_identity_requirements_met(v_user_id)` itself.** Because the RPC is SECURITY DEFINER as the postgres owner, its booking INSERT bypasses ordinary RLS enforcement. This means the identity-approval gate on the table policy is not sufficient to protect this RPC path.

**Recommended correction:** Add an explicit server-side identity-approval check inside the reservation RPC (using the existing private helper) or change execution/security architecture so the booking INSERT policy is guaranteed to apply. Prefer the explicit check as a small, testable fix, but first test in an isolated database and verify passenger, driver, operator, and admin behavior. Do not patch production directly before staging tests and a rollback plan.

## Confirmed Finding 2 — Booking hold and seat locking are implemented server-side (Positive control)

The reservation RPC sets a 15-minute hold expiry, locks the departure row and requested seat rows, releases expired holds for that departure, and checks seat availability before creating the booking. Unique constraints prevent duplicate seat numbers/positions per departure. These are sound concurrency controls in source, but concurrency behavior still needs automated tests.

## Confirmed Finding 3 — Payment Edge Functions have server-side verification (Positive control, tests pending)

`paystack-checkout` is ACTIVE (version 7, JWT verification enabled). It authenticates the user, scopes booking/payment lookups to the passenger, validates NGN and amount, checks held seat count and expiry, extends scheduled holds, prevents a new checkout if a successful or pending payment exists, and initializes Paystack server-side.

`paystack-webhook` is ACTIVE (version 6, JWT verification disabled as expected for provider webhooks). It validates Paystack's HMAC SHA-512 signature, verifies reference/amount/currency/status against the payment row, records success, and calls `confirm_paid_booking`. Duplicate success events can re-enter confirmation, which is designed to be repeatable.

**Remaining risks to test:** concurrent checkout attempts; webhook vs callback races; late payment after hold release; confirmation failure after payment success; duplicate webhook delivery; refund/support reconciliation. The code has a manual support path for payment verified but seat confirmation failed.

## Confirmed Finding 4 — Published departure and company gates exist in database policies (Positive control, publication workflow test pending)

The live RLS policy restricts company managers to updating departures while they remain drafts and unverified. Super-admin policy permits admin operations. Public departure/seat reads are gated by published/upcoming/verified status and active approved company status. Browser-side publishing is therefore not the sole control; database policy restricts company manager updates. Review admin publication/audit metadata and test role boundaries before production launch.

## Confirmed Finding 5 — Public RPC access to departure search and seat status is intentional-looking but should be data-reviewed

`search_scheduled_departures` and `get_scheduled_departure_seats` are SECURITY DEFINER functions executable by anon and authenticated users. Search returns public schedule/operator/vehicle fields; seat-status RPC returns seat numbers and availability states, not passenger identity. This appears consistent with public trip discovery and seat selection. Keep exposed fields minimal and periodically verify that private booking identifiers/contact details cannot leak.

## Supabase Advisor observations

- Security advisor flags public/anonymous execute grants on the public departure search, seat status, and public ticket verification RPCs. These are designed public endpoints, but they must remain carefully data-limited.
- Authenticated execute warnings on several SECURITY DEFINER RPCs are advisories; inspect each function's internal role/ownership checks before changing grants.
- Leaked-password protection is reported disabled. Recommendation: enable in Auth security settings (configuration change not performed).
- Performance advisor reports three unindexed foreign keys, five auth/RLS-initplan findings, six multiple-permissive-policy findings, and many unused indexes. Unused-index suggestions are not immediate deletions; evaluate after observing workload.
- Payment provider reference has a unique index. Scheduled seat uniqueness indexes cover seat number and row/position per departure.

## Live operational data snapshot (read-only)

At audit time, there were **no rows** in `scheduled_departures`, `scheduled_departure_seats`, or `payments`. Thus intercity schedules, seat inventory, and recorded payment activity are not yet demonstrated as operational in the database. Booking table records exist, but they do not prove the scheduled intercity flow is operating.

## Prior source-only findings now updated

- Browser timer is not an authoritative expiry control; the server correctly checks expiry and renews holds at checkout.
- UI max-seat selection is backed by the RPC's own 1–8 validation.
- Admin publish flow directly updates the table; database RLS restricts company managers to draft/unverified state, but the admin publishing/audit workflow needs further testing.
- Staff seat blocking is through an RPC with server-side authorization and transition checks.


## Expanded Supabase advisor snapshot (2026-11-22)

- **SECURITY WARN:** 3 SECURITY DEFINER functions are callable by anon: `get_scheduled_departure_seats`, `search_scheduled_departures`, and `verify_public_scheduled_ticket`. Their public access appears intentional for trip discovery, seat map, and ticket verification, but each response shape must be reviewed for data minimization.
- **SECURITY WARN:** 11 SECURITY DEFINER functions are callable by authenticated users. The advisor lists identity-review, driver discovery, ticket retrieval, trip-contact, company registration, seat reservation, public search, consent, seat management, and ticket verification RPCs. These grants are not automatically defects; their internal authorization checks must be reviewed function-by-function.
- **AUTH WARN:** leaked-password protection is disabled. Enable after configuration owner review.
- **PERFORMANCE INFO:** 3 foreign keys lack covering indexes (identity submission reviewer; scheduled departure creator and verifier).
- **PERFORMANCE WARN:** 5 RLS policies re-evaluate auth calls per row; adviser recommends scalar subselects for init-plan caching.
- **PERFORMANCE WARN:** 6 tables have multiple permissive SELECT policies.
- **PERFORMANCE INFO:** 49 indexes are reported unused. Do not drop them solely from this snapshot; usage data may be reset or low-volume, and indexes can support rare critical queries.

## Corrective migration drafted (not applied)

A proposed migration has been committed at `supabase/migrations/202611220001_enforce_identity_gate_in_scheduled_reservations.sql`. It copies the currently observed reservation RPC and adds an explicit call to `private.hanyago_identity_requirements_met(v_user_id)` before departure locking/booking creation. This directly addresses the confirmed SECURITY DEFINER/RLS bypass.

A static regression guard was added at `scripts/booking-security-check.py` and wired into GitHub Actions. It verifies that the migration includes the expected helper call and that the check precedes the booking insert. This is a static check only; it does not simulate authenticated roles or execute the migration.

No staging Supabase branch currently exists. A staging database is required for behavioral tests before applying the migration to production.

## Next actions (priority order)

1. **Validate the proposed migration in a staging Supabase branch.**
2. Create disposable test coverage for approved/unapproved passengers, driver/operator roles, admin, concurrent same-seat reservations, expired holds, and checkout/webhook races.
3. Inspect and test `confirm_paid_booking` and hold-release lifecycle, including late payment handling and idempotency.
4. Enable leaked-password protection after owner approval of the Auth setting.
5. Review RLS advisor warnings; optimize only where it is safe and useful.
6. Verify public trip discovery and seat status do not reveal booking/person identifiers.
7. Verify real trips and company/operator data before declaring the intercity service live.

## Status

Live backend access restored and read-only inspection completed. One high-priority identity-gate bypass is confirmed in the reservation RPC. A corrective migration and static regression check are committed to the repository but have **not** been applied to production. No live database changes have been made. Production readiness remains unproven.
