# HanyaGo Engineering Quality Log

This log records issues found while building the intercity booking workflow. Each item records the failure, cause, correction and safeguard so the same issue is not repeated.

## 1. RPC permissions needed explicit role auditing

- **Problem:** The effective database grants showed that some reservation, ticket-details and seat-management RPCs still had EXECUTE permission for the anonymous role.
- **Root cause:** Reusing generic REVOKE ... FROM PUBLIC statements did not remove every pre-existing explicit privilege on the anon role.
- **Why it was missed initially:** The first review checked the SQL statements and authentication checks, rather than querying effective permissions for each database role.
- **Fix:** Explicitly revoked anon access to reserve_scheduled_seats, get_my_scheduled_ticket and staff_set_scheduled_seat_status. Reservation and owner-ticket RPCs are authenticated-only; payment confirmation and hold lifecycle RPCs are service-role-only.
- **Prevention:** After each RPC migration, run has_function_privilege checks for anon, authenticated and service_role. Public search, safe public seat-state lookup and opaque-code ticket verification are the only intercity RPCs intentionally available to anon.
- **Lesson:** A migration statement is not proof of the effective access policy. Audit the effective grants and the function body.

## 2. Operator role must not be treated as a platform-admin role

- **Problem:** The existing private.is_hanyago_staff() helper returns true for both admin and operator. Using that helper as a global intercity-management check could let an operator role act outside its own company's scope.
- **Root cause:** The helper's name sounded broader and safer than its actual definition; role-specific behaviour was not inspected early enough.
- **Why it was missed initially:** The first policy design reused an existing helper without checking its definition and testing the admin/operator/company membership boundary.
- **Fix:** Intercity global review, publication and cancellation now checks private.is_hanyago_super_admin() (the existing platform admin check). Operators must have an active owner/admin membership in a company to create/edit its drafts. Company-linked departures cannot be published until the company is active and license-approved. A database trigger blocks self-verification by a company operator.
- **Prevention:** Before using an authorization helper, inspect its implementation. Test anonymous, passenger, operator/company manager and platform-admin access separately. Enforce role boundaries in database policies and triggers, not only in hidden buttons.
- **Lesson:** Names are not permissions. The database is the final authority, and frontend hiding is only a usability measure.

## 3. GitHub file updates require a current content SHA

- **Problem:** A small number of automated file-update attempts were rejected because the required current blob SHA was omitted.
- **Root cause:** The write call was prepared without passing the SHA returned by the fetch/read step.
- **Why it was missed:** The update was composed before validating all required tool arguments.
- **Fix:** No rejected update was treated as committed. The file was fetched again and the write retried using the current SHA.
- **Prevention:** Always fetch the latest file and pass its latest SHA on update; do not run sequential writes to the same path in parallel.
- **Lesson:** Treat every failed write as uncommitted until the repository confirms the resulting commit.

## Intercity data integrity rule

No sample departures or invented fares have been inserted into production. The live schedule has zero published departures until operations records and reviews actual operator, terminal, vehicle, departure time, fare and physical seat capacity. Official road corridors are research inputs, not proof of a bus timetable.
