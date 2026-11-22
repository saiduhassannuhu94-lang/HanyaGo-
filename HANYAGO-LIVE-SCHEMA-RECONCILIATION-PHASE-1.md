# HanyaGo Live Database vs Migration Reconciliation (Phase 1)

Date: 2026-11-22
Scope: Read-only catalog inspection of live Supabase public schema compared with tracked migration SQL. No DDL, data changes, or permission changes performed.

## Executive summary

The tracked migration file `supabase/migrations/202610200001_initial_schema.sql` is not a complete reconstruction of the live database.

- Repository tracks **1 migration**, which defines **3 core tables**: `profiles`, `bookings`, `payments`.
- Live public schema has **18 tables**, **49 RLS policies**, **13 triggers**, **29 public/private functions**, **0 public views**, and **79 indexes** (29 unique indexes).
- Fifteen live tables are not created in the tracked initial migration.
- The three migration tables have substantial live-schema additions. For example, live `bookings` has 37 columns, while the initial migration defines 13; `profiles` and `payments` also have live additions.
- All 18 public tables have RLS enabled. None have FORCE RLS enabled (catalog check).

## Live tables not represented by the tracked initial migration

1. `driver_presence`
2. `fleet_vehicles`
3. `id_verification_submissions`
4. `keke_fare_routes`
5. `keke_service_areas`
6. `profile_details`
7. `scheduled_departure_seats`
8. `scheduled_departures`
9. `transport_companies`
10. `transport_company_documents`
11. `transport_company_members`
12. `transport_fare_routes`
13. `transport_locations`
14. `transport_pricing_rules`
15. `trip_live_locations`

## Live schema inventory

### Tables
`bookings`, `driver_presence`, `fleet_vehicles`, `id_verification_submissions`, `keke_fare_routes`, `keke_service_areas`, `payments`, `profile_details`, `profiles`, `scheduled_departure_seats`, `scheduled_departures`, `transport_companies`, `transport_company_documents`, `transport_company_members`, `transport_fare_routes`, `transport_locations`, `transport_pricing_rules`, `trip_live_locations`.

### Catalog counts
- Tables: 18
- RLS policies: 49
- Triggers: 13
- Functions in public/private: 29
- Views: 0
- Indexes: 79 (29 unique)

All 18 tables have RLS enabled; FORCE RLS is false for all inspected public tables.

## Confirmed privilege anomaly: scheduled_departures

The live catalog confirms explicit table ACL for `scheduled_departures`:
`{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}`.

Effective privilege checks confirmed `anon` and `authenticated` both have TRUNCATE, DELETE, INSERT, UPDATE, SELECT on `public.scheduled_departures`. The table has RLS policies for public select and staff/company-manager insert/update. However, **TRUNCATE is not governed by row-level security**, so the RLS policies do not protect this operation. This is a serious privilege configuration finding.

Important limitation: no destructive test was run. The effective privilege was confirmed through catalog privilege checks only. No claim is made that a destructive operation was attempted. The live table is Data API exposed and has RLS enabled, but actual HTTP/API reachability of TRUNCATE was not tested. Treat as a **P1 security issue requiring immediate owner review**. Recommended action is to revoke dangerous table privileges from `anon` and `authenticated`, then re-grant only necessary SELECT/INSERT/UPDATE according to the reviewed access model. Do not execute this without a reviewed SQL change, backup/rollback plan, and owner approval.

### scheduled_departure_seats privilege check

Effective privileges for `anon` and `authenticated` on `scheduled_departure_seats` were false for SELECT, INSERT, UPDATE, DELETE and TRUNCATE in the catalog check. Table ACL was restricted to postgres and service_role.

## Migration scope / drift

The initial migration creates only profiles, bookings and payments, plus their early indexes, functions, triggers and policies. It does not reproduce the 15 additional tables, 29 live functions, 13 triggers, 49 policies, or the 79-index live inventory. It also does not include the extensive live column/constraint/index changes to the three original tables.

The prior focused identity-trigger audit is corroborated: live identity enforcement and related private helper are not represented in migration history. This phase did not perform a complete semantic diff of every function, policy, constraint, or index against migration definitions. The discrepancy is sufficient to establish migration history is incomplete, but not to certify every live object.

## Next steps

1. **P1 immediate:** Owner review of unexpected effective `TRUNCATE`/DML privileges on `public.scheduled_departures` for anon/authenticated. Preserve evidence; do not test destructively.
2. Continue catalog reconciliation by matching all function definitions, policies, triggers, constraints and indexes against tracked migration files and repo code.
3. Create a baseline migration history from a reviewed schema snapshot using supported Supabase tooling, but only after confirming the exact target project and avoiding applying it to production.
4. Reconstruct a safe free/local test environment or use static/source tests; do not create paid branches or staging.
5. No production change until full diff, rollback, owner approval and verification steps are ready.

**Status:** Significant migration/schema drift confirmed; a high-risk effective privilege configuration on scheduled departures confirmed; no live changes performed.
