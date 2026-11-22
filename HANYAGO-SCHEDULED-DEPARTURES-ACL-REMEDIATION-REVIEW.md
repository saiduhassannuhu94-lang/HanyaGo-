# HanyaGo Scheduled Departures Privilege & Default-ACL Review

Updated: 2026-11-22
Scope: read-only inspection of the live Supabase catalog and current repository source.
Project: `wtcheskbfahqpvnhyoyb`
Status: **P1 confirmed configuration risk; remediation proposed, not applied.**

## Executive finding

The live `public.scheduled_departures` table grants both `anon` and `authenticated` all table privileges, including `TRUNCATE`, `DELETE`, `INSERT`, `UPDATE`, `SELECT`, `TRIGGER`, `REFERENCES`, and `MAINTAIN` (where supported by this PostgreSQL version).

The database also has broad default table ACLs in schema `public` for objects created by both `postgres` and `supabase_admin`. Those defaults grant all table privileges to `anon`, `authenticated`, and `service_role`. The live ACL on `scheduled_departures` matches the `postgres` default ACL exactly, making default-privilege inheritance a strong explanation for the table grants. The catalog evidence does not prove the historical creation event, so this is recorded as a likely origin, not a proven audit trail.

**Why this matters:** PostgreSQL `TRUNCATE` is not governed by row-level security. RLS being enabled does not neutralize a table-level TRUNCATE grant. DELETE remains subject to RLS, but TRUNCATE does not.

No destructive operation was attempted. No public REST exploit, SQL injection path, or other live attack path was demonstrated. The privilege configuration is confirmed; practical remote exploitability is not.

## Evidence collected

### 1. Live table ACL

Catalog ACL expansion and effective privilege checks confirm broad grants to `anon` and `authenticated` on `public.scheduled_departures`. Neither role has grant option. `postgres` and `service_role` retain their administrative/service privileges.

### 2. Default table ACLs

The live `pg_default_acl` entries for schema `public` show:

- Owner `postgres`: all table privileges granted by default to `anon`, `authenticated`, `postgres`, and `service_role`.
- Owner `supabase_admin`: the same broad default table ACL pattern.

This is broader than the least-privilege posture expected for future application tables. Changing a default ACL affects future objects created by that owner; it does not repair already-created tables.

### 3. RLS policy behavior

RLS is enabled on `scheduled_departures`. Current policies are permissive policies applying to `PUBLIC`:

- SELECT: published upcoming departures that satisfy company approval rules, or super-admin/company-member visibility.
- INSERT: requires `created_by = auth.uid()` and either super-admin authority or an eligible company manager creating a draft.
- UPDATE: requires super-admin or company-manager authority; company managers are constrained to unverified drafts.

There is no DELETE policy shown for this table. These RLS rules constrain ordinary row operations, but they do not protect against TRUNCATE.

### 4. Application dependencies

Repository source `intercity-admin.js` confirms:
- authenticated operations staff load departure records;
- an authorised operator creates a draft with a direct Supabase INSERT;
- an admin publishes a departure with UPDATE;
- an admin cancels a published departure with UPDATE.

The page checks the signed-in profile role (`admin` or `operator`) in client code, but database RLS remains the real security boundary. Therefore, removing all authenticated write privileges without a replacement would break the current draft/publish workflow. The safe target is to retain only the privileges required by the existing policy-backed workflow.

The public intercity search page uses the `search_scheduled_departures` RPC. The anon SELECT grant may still be used by other public queries or future UI paths, so retain SELECT until all call sites are confirmed. No need has been identified for anon write privileges.

## Proposed remediation (NOT APPLIED)

This is a review candidate, not an instruction to execute now.

### A. Repair the existing table

Candidate SQL:

```sql
-- Remove every direct table privilege from the public/unauthenticated role.
REVOKE ALL PRIVILEGES ON TABLE public.scheduled_departures FROM anon;
GRANT SELECT ON TABLE public.scheduled_departures TO anon;

-- Preserve authenticated SELECT/INSERT/UPDATE needed by the current
-- policy-backed operator draft and admin publication workflow.
-- Remove capabilities not required by that workflow.
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
ON TABLE public.scheduled_departures
FROM authenticated;
```

Before execution, verify that no hidden client or operational workflow depends on authenticated DELETE, trigger creation, references, or maintenance privileges. The existing page source shows no direct DELETE operation for this table.

### B. Stop broad defaults for future postgres-owned tables

Candidate SQL:

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE ALL ON TABLES FROM anon, authenticated;
```

This only affects future tables created by `postgres` in `public`; it does not change existing ACLs. New application tables must receive explicit, reviewed grants. Do not apply a corresponding change for `supabase_admin` until Supabase-managed object creation and ownership dependencies are understood. Its current default ACL is a separate review item, not a reason to modify platform-managed behavior blindly.

### C. Verify after an approved change

Use read-only catalog checks after the change:

- `has_table_privilege('anon', 'public.scheduled_departures', 'TRUNCATE') = false`
- `has_table_privilege('anon', 'public.scheduled_departures', 'DELETE') = false`
- `has_table_privilege('anon', 'public.scheduled_departures', 'INSERT') = false`
- `has_table_privilege('anon', 'public.scheduled_departures', 'UPDATE') = false`
- `has_table_privilege('anon', 'public.scheduled_departures', 'SELECT') = true`
- `has_table_privilege('authenticated', 'public.scheduled_departures', 'TRUNCATE') = false`
- `has_table_privilege('authenticated', 'public.scheduled_departures', 'DELETE') = false`
- `has_table_privilege('authenticated', 'public.scheduled_departures', 'INSERT') = true`
- `has_table_privilege('authenticated', 'public.scheduled_departures', 'UPDATE') = true`
- `has_table_privilege('authenticated', 'public.scheduled_departures', 'SELECT') = true`

Then run role-specific integration tests using disposable test identities and non-production test records: anon public search; company manager draft insert; company manager cannot publish; admin can publish/cancel; unauthorised authenticated user cannot insert/update; seat generation still works. Do not test TRUNCATE by executing it.

## Risk and caveats

- Severity: P1 configuration risk because the table ACL gives public-facing roles a destructive privilege that bypasses RLS.
- Exploitability: not demonstrated. Supabase/PostgREST does not ordinarily expose arbitrary SQL TRUNCATE as a normal REST table operation. Do not imply that an anonymous HTTP request can directly truncate the table.
- Blast radius: this table holds scheduled trip inventory metadata and is operationally important. A successful TRUNCATE would remove schedule rows and cascade/constraint effects must be assessed before any repair plan.
- The default ACL finding can affect future tables created under the relevant owner role.
- No live ACL, schema, application, Edge Function, or deployment changes were made during this review.

## Decision gate

Owner approval is required before applying either the existing-table ACL repair or default-privilege change. First review the proposed SQL and confirm the current intercity workflow dependencies. Then apply in a controlled change window, immediately verify effective privileges, and run the role-specific smoke tests.

## Engineering lesson

RLS is not a substitute for least-privilege table grants. Table ACLs and RLS policies are separate security layers; both must be correct. Broad default privileges multiply the cost of every future schema change.
