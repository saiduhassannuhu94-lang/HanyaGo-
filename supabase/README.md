# HanyaGo Supabase database setup

## Status

The initial schema is version-controlled in:

`migrations/202610200001_initial_schema.sql`

**Committing this SQL file does not create tables in Supabase.** It must be reviewed and applied to the correct Supabase project before the application can use live bookings.

## Apply the migration

1. Open the intended HanyaGo project in the Supabase dashboard.
2. Confirm the project name and project URL before changing anything.
3. Open **SQL Editor** and create a new query.
4. Copy the complete SQL from `migrations/202610200001_initial_schema.sql` and run it.
5. Confirm that `profiles`, `bookings`, and `payments` exist, and that Row Level Security is enabled on all three tables.
6. Test with separate passenger and staff accounts before connecting the public booking form.

For a later CLI workflow, use the normal Supabase migration workflow so the checked-in migration history stays aligned with the database.

## Security decisions in this schema

- New accounts receive the `passenger` role regardless of the role value sent by the browser.
- Selecting `driver` or `operator` at registration is only a request; it does not grant permissions.
- A normal signed-in user cannot change their own privileged `role`.
- Passengers can create pending bookings only for themselves. The client cannot set the fare or assign a driver when creating a booking.
- Drivers can read only bookings assigned to them. Operators/admins can read bookings for operations.
- Payment records have no direct client insert/update/delete policies. A trusted server-side Paystack initialization/verification/webhook workflow must create and update them.
- Booking status changes are intentionally not exposed as direct client updates. Implement a trusted server-side workflow for cancellation, assignment, and completion.
- Do not put Supabase service-role keys or Paystack secret keys in frontend files or GitHub. Browser code may use only the Supabase publishable/legacy anon key.

## Required follow-up before launch

- Apply the migration to the intended Supabase project and confirm it succeeds.
- Configure the Supabase URL and publishable key in the frontend auth page.
- Implement a server-side Paystack integration that verifies the provider response and amount against the stored booking before marking a payment successful.
- Add server-side booking status transition rules and audit logging.
- Test RLS using passenger, driver, operator, and admin accounts, including attempts to read another passenger's bookings and to elevate one's own role.
- Run end-to-end tests on the deployed Vercel site before accepting real bookings or payments.

Until these steps are complete, the public booking form remains a preview and the live payment/booking workflow is not ready for production.
