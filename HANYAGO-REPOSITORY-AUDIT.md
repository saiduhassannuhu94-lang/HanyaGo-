# HanyaGo Repository Audit Baseline

Audit date: 2026-11-21
Repository: `saiduhassannuhu94-lang/HanyaGo-`
Default branch: `main`
Audit method: GitHub root/tree and source reads. Supabase and Vercel management APIs were attempted but denied by permissions; no live schema/deployment state is asserted.

## Confirmed repository structure

The root contains a static HTML/CSS/JavaScript application, including:
- Public pages: `index.html`, `booking.html`, `intercity.html`, `rides.html`, `keke-napep.html`, `bus.html`, `shuttle.html`, `private-car.html`, `how-it-works.html`, `faq.html`, `contact.html`, `terms.html`, `privacy.html`, `safety-rules.html`.
- Account and identity: `auth.html`, `onboarding.html`, `identity-verification.html`, `account-dashboard.html`, `account-profile.html`, `mobility-profile.html`.
- Operations/admin: `admin.html`, `admin.js`, `admin.css`, `intercity-admin.html`, `intercity-admin.js`, `transport-fares-admin.html`, `keke-fares-admin.html`, `operators.html`, `operators.js`.
- Intercity journey/ticket components: `intercity.html`, `intercity.js`, `intercity.css`, `travel-ticket.html`, `public-ticket-verify.html`, `trip-live.html`, `trip-tools.js`.
- Shared site styling/scripts and SEO files: `style.css`, `site-shell.css`, `reference-polish.css`, `animations.js`, `robots.txt`, `sitemap.xml`.
- Supabase versioned schema currently contains `supabase/migrations/202610200001_initial_schema.sql`; Supabase directory tree only contains the README and that migration in the repository tree snapshot. Live Edge Function code is not present in the checked-in tree snapshot.

## Verified observations from code

1. Intercity public search calls the database RPC `search_scheduled_departures`.
2. Seat map loads from `get_scheduled_departure_seats`.
3. Passenger seat reservation and hold lifecycle are implemented in the intercity client code as RPC workflows; exact live function definitions/grants remain unverified.
4. Intercity seat UI restricts one booking to a maximum of eight selected seats. This is a client limit; the server must enforce it independently.
5. Admin intercity page loads departures and seat inventory, supports admin-only publish/cancel UI, and requires an operator-verification note before publishing.
6. Intercity operator membership selection is scoped to active owner/admin membership for company accounts. Database policies and live company scoping must still be verified.
7. Ticket page includes QR generation and controls to verify/check payment and pay via Paystack. Payment and ticket issuance must be end-to-end tested; presence of UI is not proof.
8. Main admin page loads up to 250 booking rows, 500 profile rows, 100 payment rows, and 100 fleet rows for client-side metrics/rendering. This is a scalability and least-privilege review target; database RLS must prove that operator accounts cannot see cross-company records.
9. Main admin frontend allows profile roles `admin` and `operator` to enter the dashboard. Review all query and mutation paths for operator scope, not just page access.
10. Homepage navigation is extensive and currently includes local ride, intercity, profile, safety, live-driver, and live-trip routes. It should be audited for broken links and whether all promised pages exist.
11. `config.js` contains a public Supabase URL and publishable key, plus support contacts. No secret key should be placed there.
12. README explicitly states that the initial migration must be applied, Paystack server-side payment verification must be completed, and the application is not fully operational.

## High-priority audit risks

- **Database/RLS uncertainty:** Supabase management access denied (permission error) during audit. No live tables, policies, RPC definitions, effective grants, storage policies, or Edge Functions were verified in this pass.
- **Operator/admin scope:** Main admin dashboard loads broad datasets. RLS and RPC tests are critical to prevent data leakage to operators.
- **Payment correctness:** Ticket/payment controls exist, but Paystack checkout, verification, webhook signature, idempotency, and reconciliation require provider-backed sandbox tests.
- **Seat reservation concurrency:** UI and RPC calls exist; inspect live DB function bodies, constraints, expiry cleanup and concurrent reserve behavior. The client cannot be trusted to prevent double booking.
- **Deployment blocker:** Vercel API returned 403 authorization errors in previous and current attempts; earlier build output showed deployment quota/rate-limit blockage. Do not declare production deploy verified.
- **Architecture gap:** Current project is not a Next.js TypeScript/Tailwind app. Do not initiate a rewrite without evaluating the working flows, risks, migration costs, and release strategy.
- **Product scope mismatch:** Some public ride types (private car, shuttle, Keke) coexist with the intercity bus marketplace specification. Clarify the launch scope in product docs and ensure public search doesn't imply availability where no verified inventory exists.

## Recommended immediate work order

1. Restore authorized Supabase and Vercel project access.
2. Audit the live database table inventory, RLS policies, storage buckets/policies, RPC bodies/grants, triggers, and Edge Function versions.
3. Audit the admin query and mutation scopes against operator-company membership.
4. Inspect booking and seat hold RPCs for atomicity, unique constraints, idempotency, expiry cleanup, and transaction correctness.
5. Verify Paystack function source and secrets presence (names/metadata only, never reveal values), webhook validation, amounts and references.
6. Run static checks for all JavaScript, links, and browser flows; add test automation and build/deployment checks.
7. Only then implement the next production-safe changes and deploy.

## Status

Audit is partial because live Supabase/Vercel access was denied. Source observations above are based on the accessible GitHub default branch. Do not label the app production-ready until live access and test evidence close these gaps.
