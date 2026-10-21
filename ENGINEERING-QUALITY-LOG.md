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

## 4. Operator route deep links were overridden by default search values

- **Problem:** The operator profile page passed origin, destination and date in the query string, but the intercity page's state initialisation reset the states to Borno and Gombe after loading options. The date/redirect regexes also contained extra escaping and would not match the intended values.
- **Root cause:** The original default-state assignments were left in place after adding query-string support, and regex escaping was copied through a JavaScript string layer without a browser-level check.
- **Why it was missed:** Syntax checks pass even when a regex is valid JavaScript but matches the wrong text; the state reset was a behaviour bug rather than a syntax error.
- **Fix:** Removed the unconditional state reset, retained Borno/Gombe only as initial defaults, corrected the date and ticket-redirect regexes, and reran JavaScript syntax checks.
- **Prevention:** Add behaviour tests for route query parameters, Nigeria-local travel dates, and redirect allowlists. Syntax validation alone is insufficient.
- **Lesson:** Test what the code does, not just whether the code parses.

## 5. Identity-proof UI and database schema were out of sync

- **Problem:** The signup form offered NIN slip, union card and union-number proof types that the database CHECK constraint did not accept. The union-number option also had no dedicated input and could not be submitted without a file.
- **Root cause:** The frontend options were added before applying a matching database migration and checking the complete form submission path.
- **Why it was missed:** The review checked field presence and file-format validation, but not each option against database constraints and its upload/insert branch.
- **Fix:** Expanded the permitted document types, added a private union membership number field and database column, allowed a pending number-only record without a file, and adjusted client validation and submission logic. Union-number submissions remain pending for human review.
- **Prevention:** Keep a schema-to-form mapping for every proof type; test each type's visibility, required fields, insert payload, RLS and database constraints before deployment. Never label file format checks as authenticity verification.
- **Lesson:** Every visible option must have a complete, tested path through the database.

## 6. Production deployment could not be verified after the latest commits

- **Problem:** The latest Git commit's Vercel status is failed with the build-rate-limit notice. Attempts to inspect or create a deployment also returned a team-scope 403 requesting renewed authorization.
- **Root cause:** The Vercel Hobby team reached its deployment/build limit, and the connected tool session lacks current access to the team scope.
- **Why it was missed:** Earlier commits deployed successfully, but a successful earlier deployment does not prove that later commits reached production.
- **Fix:** Kept the latest changes in GitHub and verified JavaScript/inline-script syntax and the database migration separately. No claim is made that the newest commit is live.
- **Prevention:** Check the deployed commit SHA and production smoke tests after every change. If deployment is rate-limited or team authorization fails, stop claiming the production link reflects the latest source.
- **Lesson:** A committed change is not a deployed change. Verify the exact commit serving production.
