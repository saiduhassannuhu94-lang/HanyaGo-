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

## 7. Paystack correctly refused an unconfirmed regular ride

- **Problem:** Checkout returned a message that the operator had not confirmed a payable fare, so no payment was started.
- **Root cause:** The booking remained `pending`. The checkout function requires a non-intercity ride to be `confirmed` or `assigned`, and it requires a valid fare in kobo. A displayed or quoted amount alone is not operator confirmation.
- **Why it was missed:** Testing focused on whether a fare amount existed, not whether the booking status and fare satisfied the same server-side checkout gate.
- **Fix:** Do not weaken the payment guard. Operations must review the request, enter the agreed fare in naira in the admin booking panel, set the booking to `confirmed` (or assign an approved driver), and save before the passenger retries checkout.
- **Prevention:** Test checkout against pending/no-fare, pending/quoted-fare, confirmed/fare, expired-seat-hold, duplicate-pending-payment and webhook-confirmed cases. Never create a payment record until the server-side checks pass.
- **Lesson:** Fare value and approval state are separate facts. Payment must follow confirmation, not replace it.

## 9. Account profile and private profile details

- **Problem:** The existing account dashboard had a basic profile menu, but the profile editing destination was the older mobility profile; it did not provide one consolidated, role-aware profile form for contact, about, driver/union fields, registration year, and a dashboard-visible profile photo.
- **Root cause:** Profile presentation, identity evidence, and role-specific profile details were spread across separate screens and schemas.
- **Why it was missed:** Earlier work prioritised booking/payment and identity submission gates over a complete account-profile workflow.
- **Fix:** Added `account-profile.html` with signed-in-session enforcement, editable personal/contact/about fields, owner-scoped profile details, NIN format validation, union membership and renewal year, driving-licence number/expiry, optional registration number/year, emergency contact, and profile photo upload to the existing profile-photo bucket. Added `public.profile_details` with row-level security and owner-only select/insert/update policies. Updated account-dashboard profile-menu and verification-gate links to open the new editor.
- **Prevention:** Keep identity proof review separate from self-entered profile data; profile completion must never grant a privileged role or mark a document verified. Test owner isolation, photo upload, schema constraints, and dashboard photo rendering before release.
- **Lesson:** A profile field is user-supplied information, not verified identity. NIN format validation is not NIMC verification; driver/operator access still depends on the existing approval gate.
- **QA status:** Migration applied; expected columns confirmed in Supabase; embedded JavaScript syntax parsed successfully. Full browser/end-to-end testing and live deployment verification remain outstanding.


## 10. Booking page now requires a signed-in account before showing the form

- **Problem:** The booking submit handler already required a Supabase session before saving a real booking, but a signed-out visitor could still open and fill the booking form before being redirected on submit.
- **Root cause:** Authentication was enforced at the transaction boundary but not at the booking-page entry point.
- **Why it was missed:** Earlier checks concentrated on preventing unauthenticated database inserts and Paystack checkout, rather than the complete visitor experience.
- **Fix:** Added a page-entry session check in `script.js`. The booking page stays hidden during the check; signed-out visitors are redirected to `auth.html?redirect=booking`. If Supabase is unavailable, the form cannot submit a fake preview as a real booking and displays an explicit service-unavailable message.
- **Prevention:** Test direct navigation to `booking.html` with no session, a valid session, expired session, and unavailable Supabase configuration. Keep server-side/RLS checks even when the page is gated.
- **Lesson:** A frontend gate improves the flow, but only database and server-side checks provide the security boundary.
- **QA status:** Embedded JavaScript syntax check passed. Vercel check for commit `95c2d504e868d4c7db2034587a37dc05f4ad4607` is pending; production behaviour and real-browser redirects are not yet verified.


## 11. Preserve the requested destination through signup confirmation

- **Problem:** A signed-out visitor who started from a booking action could be sent to authentication, but email confirmation or password recovery could return to the generic auth URL without the original booking intent.
- **Root cause:** The auth redirect URL was fixed to `auth.html` and did not carry an allowlisted internal destination.
- **Why it was missed:** Login and OAuth redirect paths had been checked separately from email-confirmation and recovery links.
- **Fix:** The auth page now carries forward only known internal destination values (such as `booking`, `intercity`, and `dashboard`) in its confirmation/recovery URL. Arbitrary external URLs are not accepted, preventing an open redirect.
- **Prevention:** Test email/password, email confirmation, password recovery, and each enabled OAuth provider with and without a redirect parameter. Verify the destination after the full provider round-trip.
- **Lesson:** Preserve user intent across authentication, but only through a strict internal destination allowlist.
- **QA status:** Inline script syntax check passed. Vercel check for commit `ffe822b7a29f1da08e2c3af1a8fc507914631022` is successful; full real-browser auth-provider tests remain outstanding.


## 12. AI-assisted identity-document quality triage (not identity approval)

- **Problem:** Identity submissions were placed in a single manual-review queue, while file extension/MIME checks could not tell whether the document was readable or matched the selected document type.
- **Root cause:** Upload validation and human approval were the only workflow stages; no separate AI quality-triage state existed.
- **Why it was missed:** Earlier checks focused on storage privacy, RLS, and role-approval rules rather than the review workload and document quality.
- **Fix:** Added AI-only assessment fields to `id_verification_submissions` and deployed the authenticated `ai-identity-triage` Supabase Edge Function. The function checks the caller's session and submission ownership, reads the document from private storage, asks Gemini for structured document-quality/type feedback, stores only bounded non-sensitive flags/summary, and never writes `status=approved` or changes a user's role. The identity-verification form invokes the triage function after upload and displays the result. If the AI provider key is absent or the provider fails, the document remains pending.
- **Prevention:** Keep AI quality checks separate from authenticity checks and role activation. Never send OCR text or identity numbers into the stored summary; never log document contents; test owner isolation, file size/type, provider outage, malformed model output, and repeat calls. Add official registry integrations only through authorised providers with explicit privacy/legal approval.
- **Lesson:** AI can reduce sorting and document-quality work, but it cannot claim NIN, driving-licence, union, school or business authenticity without a trusted registry connection. Driver/operator privilege remains subject to the existing secure approval function.
- **QA status:** Database fields verified; edge function reports ACTIVE with JWT verification enabled; identity-verification inline JavaScript syntax passed. The Gemini secret `GEMINI_API_KEY` has not been configured through the available tool access, so live AI analysis is not yet activated. Vercel deployment check and real end-to-end invocation remain to be verified.


## 13. AI triage frontend deployment is blocked by the Vercel build limit

- **Problem:** The frontend commit integrating AI triage passes inline JavaScript syntax checks, but Vercel reports a build-rate-limit failure. The production website therefore cannot be assumed to contain this UI change.
- **Root cause:** The connected Vercel project is currently rejecting new builds because its build/deployment limit has been reached.
- **Why it was missed:** The Supabase database migration and Edge Function deploy independently of Vercel, so their success can make the whole feature look live even though the website UI is still on an older deployment.
- **Fix:** Verified the exact GitHub commit status and recorded the deployment blocker. Do not claim the production form is invoking AI until Vercel has deployed the relevant commit.
- **Prevention:** Track database migration, Edge Function deployment, frontend deployment and live end-to-end verification as separate release gates. Confirm the production commit SHA before declaring the feature live.
- **Lesson:** A working backend function does not make a feature live if the frontend deployment is blocked.
- **Current status:** Supabase Edge Function `ai-identity-triage` is ACTIVE (JWT required), and the AI triage schema exists. The frontend commit `75a0273ff501ac3a6ab6444e8c0667a46d659740` is not deployed because Vercel returned `build-rate-limit`. `GEMINI_API_KEY` is also still required in Supabase Edge Function secrets before model calls can run.


## 14. A single guided onboarding flow is now the account entry point

- **Problem:** Signup, identity upload, approval status and dashboard access were spread across separate pages, and successful sign-in could send users directly to the dashboard or a booking page. The dashboard and onboarding logic also needed a consistent definition of role-specific approved proof.
- **Root cause:** Each page had evolved its own navigation and approval checks rather than using one predictable account journey.
- **Why it was missed:** Individual pages were reviewed in isolation; cross-page navigation after signup, password login, phone OTP and social sign-in was not treated as one workflow.
- **Fix:** Added `onboarding.html` as a guided four-step hub (account, proof, review, dashboard); routed successful password, phone OTP and social sign-ins to onboarding; sent new accounts with an active session there after signup; locked local booking and intercity seat reservation behind sign-in and the required approved proof; and made dashboard proof checks match the requested account role. The identity page now keeps the requested account type fixed for the application. Database enforcement was added through a private role-aware approval helper, a booking insert trigger and an RLS insert policy, so frontend navigation is not the only barrier.
- **Prevention:** Test the complete journey for passenger, driver, operator and admin separately; test direct URLs as well as navigation links; confirm proof types are scoped to the requested role; and verify the trigger/RLS behaviour against pending, rejected and approved accounts.
- **Lesson:** Navigation is not authorization. Every restricted workflow needs both a coherent frontend journey and a database-enforced access rule.
- **QA status:** Onboarding page committed as `7a80acc345fe243b68de27c5dc5f10768b9f59a5`; follow-up commits update its Supabase config, auth redirects, booking gates and role-specific dashboard/proof behaviour. Supabase migration applied and helper query returned 1 account with the required approval out of 5 profiles (this count includes privileged staff if configured). No real-browser end-to-end test has been completed. Vercel has previously returned `build-rate-limit`; do not assume these frontend changes are in production until a successful deployment is verified.
