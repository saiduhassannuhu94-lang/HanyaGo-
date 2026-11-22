-- Enforce identity approval inside the SECURITY DEFINER reservation RPC.
-- RLS on public.bookings is bypassed by this function's postgres owner,
-- so the approval helper must be called explicitly here.
-- Apply only after staging regression tests and a backup are confirmed.

create or replace function public.reserve_scheduled_seats(
  p_departure_id uuid,
  p_seat_numbers text[],
  p_ticket_passenger_name text,
  p_ticket_passenger_phone text,
  p_booking_contact_phone text,
  p_booked_for_other boolean,
  p_relationship_to_passenger text default null,
  p_passenger_notes text default null
)
returns table (
  booking_id uuid,
  fare_kobo bigint,
  hold_expires_at timestamptz,
  seat_numbers text[],
  operator_name text,
  departure_at timestamptz,
  origin_city text,
  destination_city text
)
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_trip public.scheduled_departures%rowtype;
  v_profile_name text;
  v_booking_id uuid;
  v_total_fare bigint;
  v_hold_until timestamptz := now() + interval '15 minutes';
  v_requested_count integer;
  v_available_count integer;
  v_ride_type text;
begin
  if v_user_id is null then
    raise exception 'Please sign in before reserving a seat.' using errcode = '28000';
  end if;

  if p_departure_id is null or p_seat_numbers is null
     or cardinality(p_seat_numbers) < 1 or cardinality(p_seat_numbers) > 8 then
    raise exception 'Choose between one and eight seats.' using errcode = '22023';
  end if;

  select count(distinct btrim(x)) into v_requested_count from unnest(p_seat_numbers) as t(x);
  if v_requested_count <> cardinality(p_seat_numbers)
     or exists (select 1 from unnest(p_seat_numbers) as t(x) where btrim(x) = '') then
    raise exception 'The seat list contains duplicates or invalid values.' using errcode = '22023';
  end if;

  if p_ticket_passenger_name is null
     or char_length(btrim(p_ticket_passenger_name)) < 2
     or char_length(btrim(p_ticket_passenger_name)) > 120 then
    raise exception 'Enter the passenger’s full name.' using errcode = '22023';
  end if;
  if p_ticket_passenger_phone is null
     or char_length(btrim(p_ticket_passenger_phone)) < 7
     or char_length(btrim(p_ticket_passenger_phone)) > 20
     or char_length(regexp_replace(p_ticket_passenger_phone, '[^0-9]', '', 'g')) < 7 then
    raise exception 'Enter a valid passenger phone number.' using errcode = '22023';
  end if;
  if p_booking_contact_phone is null
     or char_length(btrim(p_booking_contact_phone)) < 7
     or char_length(btrim(p_booking_contact_phone)) > 24
     or char_length(regexp_replace(p_booking_contact_phone, '[^0-9]', '', 'g')) < 7 then
    raise exception 'Enter a valid booking contact phone number.' using errcode = '22023';
  end if;
  if p_booked_for_other is null then
    raise exception 'Choose whether you are booking for yourself or another passenger.' using errcode = '22023';
  end if;
  if p_booked_for_other and (
       p_relationship_to_passenger is null
       or char_length(btrim(p_relationship_to_passenger)) < 2
       or char_length(btrim(p_relationship_to_passenger)) > 80
     ) then
    raise exception 'Choose or enter your relationship to the passenger.' using errcode = '22023';
  end if;
  if not p_booked_for_other and p_relationship_to_passenger is not null then
    raise exception 'A relationship is only required when booking for another person.' using errcode = '22023';
  end if;
  if p_passenger_notes is not null and char_length(p_passenger_notes) > 1000 then
    raise exception 'Additional notes are too long.' using errcode = '22023';
  end if;

  select p.full_name into v_profile_name
  from public.profiles p where p.id = v_user_id;
  if v_profile_name is null or char_length(btrim(v_profile_name)) < 2 then
    raise exception 'Complete your account profile name before booking.' using errcode = '22023';
  end if;

  -- SECURITY DEFINER executes as the postgres owner and bypasses table RLS.
  -- Do not rely on the bookings INSERT policy to enforce identity approval.
  if not private.hanyago_identity_requirements_met(v_user_id) then
    raise exception 'Your identity verification must be approved before booking.' using errcode = '42501';
  end if;

  select d.* into v_trip
  from public.scheduled_departures d
  left join public.transport_companies c on c.id = d.company_id
  where d.id = p_departure_id
    and d.status = 'published'
    and d.departure_at > now() + make_interval(mins => d.booking_cutoff_minutes)
    and (d.company_id is null or (c.company_status = 'active' and c.license_status = 'approved'))
  for update of d;
  if not found then
    raise exception 'This departure is not available for booking.' using errcode = 'P0001';
  end if;

  update public.scheduled_departure_seats s
     set status = 'available', booking_id = null, hold_expires_at = null, updated_at = now()
   where s.departure_id = p_departure_id
     and s.status = 'held'
     and s.hold_expires_at <= now();

  perform s.id
  from public.scheduled_departure_seats s
  where s.departure_id = p_departure_id
    and s.seat_number = any(p_seat_numbers)
  order by s.seat_number
  for update;

  select count(*)::integer into v_available_count
  from public.scheduled_departure_seats s
  where s.departure_id = p_departure_id
    and s.seat_number = any(p_seat_numbers)
    and s.status = 'available';
  if v_available_count <> cardinality(p_seat_numbers) then
    raise exception 'One or more selected seats are no longer available. Refresh the seat map and choose again.' using errcode = 'P0001';
  end if;

  v_total_fare := v_trip.fare_kobo * cardinality(p_seat_numbers);
  v_ride_type := case v_trip.ride_type
    when 'Shuttle' then 'Shuttle'
    when 'Luxury Coach' then 'Luxury Vehicle'
    else 'Bus / Shared Ride'
  end;

  insert into public.bookings (
    passenger_id, pickup_location, destination, travel_date, travel_time,
    passenger_count, passenger_phone, passenger_notes, ride_type, status,
    fare_kobo, fare_quote_kobo, fare_quote_currency, fare_quote_created_at,
    currency, company_id, scheduled_departure_id, passenger_location_sharing,
    ticket_passenger_name, booking_contact_name, booking_contact_phone,
    booked_for_other, relationship_to_passenger
  ) values (
    v_user_id,
    left(v_trip.origin_city || ' — ' || v_trip.origin_terminal, 180),
    left(v_trip.destination_city || ' — ' || v_trip.destination_terminal, 180),
    (v_trip.departure_at at time zone 'Africa/Lagos')::date,
    (v_trip.departure_at at time zone 'Africa/Lagos')::time,
    cardinality(p_seat_numbers),
    btrim(p_ticket_passenger_phone),
    nullif(btrim(p_passenger_notes), ''),
    v_ride_type,
    'pending',
    v_total_fare,
    v_total_fare,
    'NGN',
    now(),
    'NGN',
    v_trip.company_id,
    v_trip.id,
    false,
    btrim(p_ticket_passenger_name),
    btrim(v_profile_name),
    btrim(p_booking_contact_phone),
    p_booked_for_other,
    case when p_booked_for_other then btrim(p_relationship_to_passenger) else null end
  )
  returning id into v_booking_id;

  update public.scheduled_departure_seats s
     set status = 'held', booking_id = v_booking_id, hold_expires_at = v_hold_until, updated_at = now()
   where s.departure_id = p_departure_id
     and s.seat_number = any(p_seat_numbers)
     and s.status = 'available';

  return query select v_booking_id, v_total_fare, v_hold_until,
    (select array_agg(btrim(x) order by btrim(x)) from unnest(p_seat_numbers) as t(x)),
    v_trip.operator_name, v_trip.departure_at, v_trip.origin_city, v_trip.destination_city;
end;
$function$;
