# HanyaGo.ng — Production Engineering Roadmap

This is the active implementation plan for **HanyaGo.ng**. The existing HanyaGo repository, Supabase project, domain/brand, implemented flows, security controls, and decisions must be preserved. This roadmap is additive; it is not permission to replace the platform or start a duplicate project.

## Product and business rules

- Nigerian intercity bus booking marketplace; Nigerian naira (NGN).
- Roles: passengers, verified transport companies, company-linked drivers, HanyaGo administrators.
- Only approved transport companies own/list buses. Drivers cannot list vehicles independently and must be attached to an approved company.
- HanyaGo administrators control routes, stops, schedules, departure times, published trips, fares, platform fees, and commissions.
- Companies manage their fleet and drivers within approved scope, but cannot publish public trips or set official fares.
- Verify companies, drivers, and vehicles before operational use.
- Keep passenger payments, company proceeds, platform booking commissions, subscription revenue, refunds, and settlements distinct in a reconciled financial ledger.
- No fabricated production companies, departures, vehicles, seat availability, transactions, reviews, or statistics.

## Technology constraints

Preserve the current GitHub + Supabase + Vercel implementation unless an audit demonstrates a compelling migration need. The current repository is browser-based HTML/CSS/JavaScript, so a Next.js/TypeScript/Tailwind migration is a separate, evidence-based decision—not a rewrite to perform blindly. Keep credentials server-side; never expose provider secret keys.

## Existing work to preserve and verify

- Supabase authentication and role-request onboarding.
- Private identity/document submissions with human approval.
- Passenger booking access gates.
- Local booking request workflow.
- Intercity trip search, booking, seat inventory/reservation and ticket-related code.
- Admin operations console and route/fare/departure management pages.
- Paystack checkout/webhook work.
- Existing database RPC permission hardening, company/admin scope checks, and engineering-quality log.

Implementation in source is not equivalent to a verified production feature. Every feature below must be tested against live configured services and deployed code.

## Release phases and acceptance criteria

### Phase 0 — Access, repository audit, and release baseline
- [ ] Inspect the entire repository tree and all relevant page/script/style/database/function files.
- [ ] Establish a clean baseline: latest commit, branch, build/deployment state, schema, RLS, RPC grants, storage policies, edge-function inventory, environment-variable names (never expose secret values).
- [ ] Fix or document the Vercel build/quota/team authorization blocker.
- [ ] Confirm the production domain and deployment target.
- **Exit criteria:** auditable baseline and reproducible deploy access; no guessed production state.

### Phase 1 — Identity, permissions, and operations onboarding
- [ ] Passenger registration, login, email verification, profile and session lifecycle.
- [ ] Company application, private document upload, human review, approved/suspended states.
- [ ] Driver application, licence/ID review, company linkage and active/suspended states.
- [ ] Vehicle submission, ownership/company linkage, capacity/seat layout and verification.
- [ ] RLS and server-side policies tested for anonymous, passenger, driver, company manager, operator and platform admin.
- **Exit criteria:** no self-approval, role escalation, cross-company data leakage, or unapproved operational access.

### Phase 2 — Trips, schedules, seat inventory, and booking engine
- [ ] Route, terminal, intermediate-stop and journey-duration management.
- [ ] Admin-created trips with company, bus and driver assignment; publish only after verification.
- [ ] Passenger search by origin, destination, travel date, and trip status.
- [ ] Trip detail, fare disclosure, fees, seat map and passenger details.
- [ ] Atomic temporary seat holds with expiry and safe release.
- [ ] Database-level collision protection and concurrency testing to prevent double booking.
- [ ] Booking reference, booking lifecycle and idempotent confirmation.
- [ ] Cancellation rules and passenger-facing status.
- **Exit criteria:** concurrent requests cannot sell the same seat; expired holds release correctly; no client can alter fare, assignment, or status outside permitted workflows.

### Phase 3 — Passenger experience
- [ ] Passenger dashboard, profile and booking history.
- [ ] Upcoming/completed/cancelled trips, tickets and payment history.
- [ ] Ticket generation, QR/code validation, downloadable/printable ticket.
- [ ] Notifications, reviews (only after eligible completed trips), support tickets.
- [ ] Cancellation and refund request UX.
- **Exit criteria:** end-to-end passenger journey works on mobile and desktop, with useful loading, empty, error and success states.

### Phase 4 — Company and driver operations
- [ ] Company dashboard: verification, fleet, drivers, assignments, manifests, trip oversight, earnings, commission statements, subscription, payout history, reports and support.
- [ ] Driver dashboard: assigned company/vehicle/trips, manifests, pickup/destination, departure, trip statuses, delays, incidents, vehicle issues, emergency reporting and history.
- [ ] Company-scoped permissions enforced server-side/database-side.
- [ ] Driver access limited to own assigned operational records.
- **Exit criteria:** company and driver can perform permitted tasks but cannot publish trips, alter official fares, or view unauthorized data.

### Phase 5 — Administrator control center
- [ ] Live, database-derived metrics with clear definitions.
- [ ] Company, driver, vehicle verification/approval/rejection/suspension.
- [ ] Routes, stops, trip schedules, assignment, publication, rescheduling and cancellation.
- [ ] Admin-controlled fares, fees, discounts and commission rules.
- [ ] Booking lookup/filter/status operations.
- [ ] Payments, refunds, payouts, settlements and reconciliation.
- [ ] Subscription plans and lifecycle.
- [ ] Homepage content, FAQs, testimonials and banners.
- [ ] Audit trail for sensitive actions.
- **Exit criteria:** each privileged action has server-side authorization, validation, audit trail and failure handling.

### Phase 6 — Payment, subscriptions, and ledger
- [ ] Paystack initialize/verify/webhook with signature checks, amount/reference reconciliation and idempotency.
- [ ] Flutterwave equivalent integration only when credentials and test environment are available.
- [ ] Payment state transitions cannot be asserted by the browser.
- [ ] Monthly/annual company subscriptions, renewal, expiry, grace period and suspension.
- [ ] Admin-controlled commission calculation.
- [ ] Separate ledger entries for gross booking, fees, company payable, commission, refund, subscription income, payout and adjustments.
- [ ] Company settlement/reconciliation reports.
- **Exit criteria:** provider-confirmed test payments reconcile; repeated webhooks do not duplicate financial entries; no real money accepted until release checks pass.

### Phase 7 — Notifications, content, and service integrations
- [ ] Transactional email templates and delivery provider.
- [ ] WhatsApp integration via approved provider and opt-in controls.
- [ ] Booking/payment confirmations, reminders, schedule changes, approvals, assignments, subscription/refund notices.
- [ ] Retry, failure visibility and notification logs.
- **Exit criteria:** user consent and delivery outcomes are recorded; failures do not silently disappear.

### Phase 8 — QA, security, and launch
- [ ] Auth/signup/login and role workflows.
- [ ] Company, driver, vehicle approvals.
- [ ] Route/trip creation and publication.
- [ ] Search, seat selection, hold expiry, concurrency/double-booking.
- [ ] Payment provider sandbox, webhooks, refund, commissions, subscription, payout.
- [ ] RLS and RPC grant matrix, privilege escalation, cross-user and cross-company access attempts.
- [ ] Mobile/desktop/browser compatibility, accessibility, input validation and rate limits.
- [ ] SEO metadata, sitemap, robots, HTTPS, production configuration, backup/recovery and incident process.
- [ ] Production smoke test against the exact deployed commit.
- **Exit criteria:** no critical/high-severity unresolved issues; deployment SHA verified; operational owners and launch limitations documented.

## Engineering operating rules

1. Audit before changing; preserve existing working flows.
2. For each change: problem → root cause → fix → prevention → tests.
3. Prefer database constraints/RPC/Edge Functions for trusted operations over frontend-only checks.
4. Use Supabase RLS on all exposed tables; explicitly audit effective grants and function execution privileges.
5. Never commit secrets or place them in client code.
6. Never report deployment, payment, approval, or test success without direct verification.
7. Track each phase as not started / in progress / blocked / verified. Evidence is required for verified status.
8. If credentials or access are blocked, continue with code/documentation/tests that do not require that access, and report the exact blocker.

## Current blockers (last verified in previous audit)

- Vercel deployment/project API access returned 403 authorization errors and earlier builds showed a deployment quota/rate-limit blocker.
- Supabase management access returned permission errors in the last session; schema/functions could not be freshly inspected.
- Payment integrations have not been proven end-to-end in sandbox or production.
- Published live trips and operational inventory must remain empty until real approved operator, vehicle, schedule, price, and seat inventory records are entered and verified.

## Release status

**Overall: IN PROGRESS — NOT PRODUCTION READY.** The next work item is Phase 0: full source-tree audit, database/security baseline and deployment access recovery. This status must be updated only when evidence exists.
