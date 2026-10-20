-- HanyaGo initial database schema
-- Generated for version control. Review and apply to the intended Supabase project
-- only after confirming the project URL and backup/state.
-- Security model: new accounts always receive the passenger role. A selected
-- driver/operator role is stored as a request and grants no elevated access.

begin;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  role text not null default 'passenger'
    check (role in ('passenger', 'driver', 'operator', 'admin')),
  requested_role text not null default 'passenger'
    check (requested_role in ('passenger', 'driver', 'operator')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references public.profiles(id) on delete restrict,
  pickup_location text not null check (length(trim(pickup_location)) between 2 and 180),
  destination text not null check (length(trim(destination)) between 2 and 180),
  travel_date date not null,
  ride_type text not null
    check (ride_type in ('Private Car', 'Bus / Shared Ride', 'Shuttle')),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled')),
  assigned_driver_id uuid references public.profiles(id) on delete set null,
  fare_kobo bigint check (fare_kobo is null or fare_kobo >= 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  passenger_notes text check (passenger_notes is null or length(passenger_notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_distinct_locations
    check (lower(trim(pickup_location)) <> lower(trim(destination)))
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  passenger_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null default 'paystack' check (provider = 'paystack'),
  provider_reference text not null unique,
  amount_kobo bigint not null check (amount_kobo > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  status text not null default 'pending'
    check (status in ('pending', 'success', 'failed', 'abandoned', 'refunded')),
  paid_at timestamptz,
  provider_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookings_passenger_created_idx
  on public.bookings (passenger_id, created_at desc);
create index if not exists bookings_status_date_idx
  on public.bookings (status, travel_date);
create index if not exists bookings_driver_date_idx
  on public.bookings (assigned_driver_id, travel_date)
  where assigned_driver_id is not null;
create index if not exists payments_passenger_created_idx
  on public.payments (passenger_id, created_at desc);
create index if not exists payments_booking_idx
  on public.payments (booking_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

-- Block privilege escalation through client-side profile updates.
-- Trusted server-side operations using the service role can approve roles.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role then
    raise exception 'Profile role changes must be approved by HanyaGo administrators.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
before update on public.profiles
for each row execute function public.protect_profile_role();

-- Create every new profile as a passenger, regardless of user-supplied role
-- metadata. Driver/operator selection is only a request for later review.
create or replace function public.handle_new_hanyago_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested text;
begin
  requested := coalesce(new.raw_user_meta_data ->> 'role', 'passenger');
  if requested not in ('passenger', 'driver', 'operator') then
    requested := 'passenger';
  end if;

  insert into public.profiles (id, full_name, phone, role, requested_role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), ''),
    'passenger',
    requested
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_hanyago on auth.users;
create trigger on_auth_user_created_hanyago
after insert on auth.users
for each row execute function public.handle_new_hanyago_user();

-- Security-definer helper avoids recursive profile RLS checks.
create or replace function public.is_hanyago_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('admin', 'operator')
  );
$$;

revoke all on function public.is_hanyago_staff() from public;
grant execute on function public.is_hanyago_staff() to authenticated;

alter table public.profiles enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using (id = (select auth.uid()) or public.is_hanyago_staff());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "Passengers and staff can read bookings" on public.bookings;
create policy "Passengers and staff can read bookings"
on public.bookings for select
to authenticated
using (
  passenger_id = (select auth.uid())
  or assigned_driver_id = (select auth.uid())
  or public.is_hanyago_staff()
);

drop policy if exists "Passengers can create their own pending bookings" on public.bookings;
create policy "Passengers can create their own pending bookings"
on public.bookings for insert
to authenticated
with check (
  passenger_id = (select auth.uid())
  and status = 'pending'
  and assigned_driver_id is null
  and fare_kobo is null
  and currency = 'NGN'
);

drop policy if exists "Passengers can read their own payments" on public.payments;
create policy "Passengers can read their own payments"
on public.payments for select
to authenticated
using (passenger_id = (select auth.uid()) or public.is_hanyago_staff());

-- Intentionally no client INSERT/UPDATE/DELETE policies for payments or
-- client UPDATE/DELETE policies for bookings. Trusted server-side workflows
-- must initialize/verify payments and control booking status transitions.
-- Never expose the Supabase service-role key in browser code.

commit;
