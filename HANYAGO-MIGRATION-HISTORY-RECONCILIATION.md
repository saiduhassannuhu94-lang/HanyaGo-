# HanyaGo Migration History Reconciliation Review

Date: 2026-11-22
Scope: Read-only comparison of tracked migrations against live Supabase identity enforcement. No production writes.

## Repository state

- Only one migration file currently tracked under `supabase/migrations/`: `202610200001_initial_schema.sql`.
- The initial migration defines bookings tables, the `bookings_set_updated_at` trigger, and baseline booking RLS policies.
- It does not define the live approved-identity trigger/function or the helper function that evaluates identity-document approvals.

## Live identity enforcement (observed)

### Trigger
- Trigger name: `bookings_require_approved_identity`
- Event: BEFORE INSERT on `public.bookings`
- Calls: `private.enforce_approved_identity_before_booking()`
- Trigger function: PL/pgSQL, `SECURITY DEFINER`, owner `postgres`, `SET search_path TO ''`
- Function body checks `auth.uid()` is non-null and then calls `private.hanyago_identity_requirements_met(auth.uid())`; raises an identity approval error if false.
- Trigger function execute privilege is limited to postgres in the inspected ACL.

### Identity helper
- Function: `private.hanyago_identity_requirements_met(uuid)`
- PL/pgSQL, STABLE, `SECURITY DEFINER`, owner `postgres`, empty search_path.
- Checks profile role/requested_role and approved document submissions.
- Driver requires approved identity proof plus driver's license.
- Operator requires approved identity proof plus business proof or employee ID.
- Passenger/general role uses approved accepted passenger proof types.
- Admin profile role returns true (bypass).
- Execute grants observed: authenticated, postgres, service_role. Function is in the private schema.

### RLS overlap
The current live bookings INSERT policy also calls the identity helper and restricts passenger_id to auth.uid(), status to pending, assigned_driver_id null, fare_kobo null, and currency NGN. The identity trigger provides an additional enforcement layer for INSERT paths that may bypass RLS, including the SECURITY DEFINER reservation RPC. This makes the earlier drafted explicit RPC replacement migration redundant for the observed live schema.

## Risk and limits

- The production identity enforcement logic exists and was inspected, but it is not reproducibly represented in the repository's migration history.
- A fresh environment created from tracked migrations alone will not necessarily reproduce live identity enforcement. The initial migration alone is not a complete current-schema reconstruction.
- Function text, trigger definition, ownership, and ACLs were observed via read-only queries. No role-based runtime tests were run, and no attempt was made to impersonate passenger/driver/operator/admin identities.
- We did not fully diff every live table, column, policy, function, index, extension, or storage object against the repository baseline. This is a focused drift finding, not a complete schema diff.

## Reconciliation recommendation (no production change)

1. Treat the live database as evidence, not automatically as the desired source of truth. Confirm the intended identity rules and privileged service-role bypass with the project owner.
2. Reconstruct a complete schema snapshot/diff from the live database using supported Supabase migration tooling in a free/local environment where possible.
3. Establish a repeatable local migration baseline and test the identity trigger/helper with role-specific test identities.
4. Add a forward migration that reproduces the approved trigger/helper logic on a fresh database, including exact dependencies, grants, ownership/security settings, and policy requirements.
5. Test fresh setup and upgrade paths against disposable local data before applying anything to production.
6. Keep production unchanged until the migration plan, diff, tests, rollback, and approval are complete.

## Decision

**No production migration should be applied now.** The redundant RPC migration draft was retired. The next safe work is to collect a broader schema snapshot and map live objects to tracked migrations before writing a corrective migration.

Status: Focused identity drift verified; full schema reconciliation not complete.
