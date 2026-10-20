# HanyaGo

HanyaGo is a transport journey-planning and booking web app. The current frontend is deployed through the GitHub + Vercel workflow; Supabase provides authentication and the booking database, while Paystack will be added later through a trusted server-side payment flow.

## Current implementation

- Responsive homepage with ride options, FAQs, and client-side form validation.
- Sign-in, sign-up, and password-reset UI using Supabase Auth.
- Shared public Supabase configuration in `config.js`.
- Booking form submits a pending booking to Supabase for a signed-in passenger when configuration and the database are ready.
- If Supabase is not configured, the form clearly stays in preview mode and does not claim that a booking was saved.
- Initial database migration and security policies are version-controlled in `supabase/migrations/`.

## Setup sequence

1. **Confirm the correct Supabase project.** Open its Project URL and API settings.
2. **Apply the migration.** Run `supabase/migrations/202610200001_initial_schema.sql` in the Supabase SQL Editor, after checking that the project is the intended one.
3. **Configure public client values.** In `config.js`, replace the placeholders with the Supabase project URL and publishable key (or legacy anon key).
4. **Configure Auth URLs.** In Supabase Auth settings, set the production Site URL to the Vercel domain and add the production and local development callback URLs to the allowed redirect URLs.
5. **Deploy and test.** Let Vercel deploy the GitHub commit, then test signup, email confirmation, sign-in, password reset, booking creation, and cross-user access.
6. **Before launch.** Add the server-side Paystack initialization, verification, and webhook workflow; publish real Terms of Service and Privacy Policy pages; and test the complete app on mobile and desktop.

More detailed database instructions are in [supabase/README.md](supabase/README.md).

## Security rules

- The Supabase publishable/anon key is designed for browser use. Database permissions must be enforced by Row Level Security policies.
- **Never** put a Supabase `service_role` key, database password, or Paystack secret key in `config.js`, HTML, browser JavaScript, or a committed file.
- Client-selected driver/operator status is only a request. Elevated roles must be approved through a trusted administrative process.
- A booking with status `pending` is only a request. It is not a confirmed ride, assigned driver, guaranteed fare, or successful payment.
- Never mark a payment as successful based only on a browser redirect. Verify it server-side with Paystack and a signed/verified webhook.

## Current limitations

- The database migration is committed but must be applied and tested in the intended Supabase project.
- Real booking submission requires the public Supabase values in `config.js`, a valid signed-in session, and the migration to be applied.
- Paystack and driver/operator/admin operations are not yet implemented.
- A successful GitHub commit does not by itself prove that the Vercel deployment has completed or that production behavior has been tested.
