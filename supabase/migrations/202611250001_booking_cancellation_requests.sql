-- HanyaGo cancellation requests (draft migration; NOT applied to production)
-- Apply only after review, staging-free QA plan, and explicit owner approval.

BEGIN;

CREATE TABLE IF NOT EXISTS public.booking_cancellation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  passenger_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 5 AND 1000),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  review_note text CHECK (review_note IS NULL OR char_length(review_note) <= 1000),
  withdrawn_at timestamptz,
  CONSTRAINT cancellation_review_state_consistency CHECK (
    (status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL AND withdrawn_at IS NULL)
    OR (status IN ('approved','rejected') AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL AND withdrawn_at IS NULL)
    OR (status = 'withdrawn' AND withdrawn_at IS NOT NULL AND reviewed_at IS NULL AND reviewed_by IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS booking_cancellation_one_pending
  ON public.booking_cancellation_requests(booking_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS booking_cancellation_passenger_recent
  ON public.booking_cancellation_requests(passenger_id, created_at DESC);
CREATE INDEX IF NOT EXISTS booking_cancellation_review_queue
  ON public.booking_cancellation_requests(created_at) WHERE status = 'pending';

ALTER TABLE public.booking_cancellation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Passengers and authorized staff read cancellation requests"
  ON public.booking_cancellation_requests;
CREATE POLICY "Passengers and authorized staff read cancellation requests"
  ON public.booking_cancellation_requests FOR SELECT TO authenticated
  USING (
    passenger_id = auth.uid()
    OR private.is_hanyago_staff()
    OR (EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_cancellation_requests.booking_id
        AND b.company_id IS NOT NULL
        AND private.is_company_member(b.company_id)
    ))
  );

-- No direct insert/update/delete for authenticated clients. Mutations occur through RPCs.
REVOKE ALL ON public.booking_cancellation_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.booking_cancellation_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.request_booking_cancellation(p_booking_id uuid, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_request_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to request cancellation.' USING ERRCODE = '28000';
  END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) < 5 OR char_length(btrim(p_reason)) > 1000 THEN
    RAISE EXCEPTION 'Provide a cancellation reason between 5 and 1000 characters.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_booking FROM public.bookings
    WHERE id = p_booking_id AND passenger_id = auth.uid()
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found for this account.' USING ERRCODE = 'P0002';
  END IF;
  IF v_booking.status NOT IN ('pending','confirmed','assigned') THEN
    RAISE EXCEPTION 'This booking is not eligible for cancellation request.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.booking_cancellation_requests (booking_id, passenger_id, reason)
  VALUES (p_booking_id, auth.uid(), btrim(p_reason))
  RETURNING id INTO v_request_id;
  RETURN v_request_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.review_booking_cancellation(
  p_request_id uuid,
  p_decision text,
  p_review_note text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE
  v_request public.booking_cancellation_requests%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_seat_count integer;
  v_reviewer uuid := auth.uid();
BEGIN
  IF v_reviewer IS NULL THEN
    RAISE EXCEPTION 'Sign in to review cancellation requests.' USING ERRCODE = '28000';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approve','reject') THEN
    RAISE EXCEPTION 'Decision must be approve or reject.' USING ERRCODE = '22023';
  END IF;
  IF p_review_note IS NOT NULL AND char_length(p_review_note) > 1000 THEN
    RAISE EXCEPTION 'Review note is too long.' USING ERRCODE = '22023';
  END IF;

  -- Lock booking first, matching passenger-request RPC order to reduce deadlocks.
  SELECT b.* INTO v_booking FROM public.bookings b
    JOIN public.booking_cancellation_requests r ON r.booking_id=b.id
    WHERE r.id=p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking/request not found.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM 1 FROM public.bookings WHERE id=v_booking.id FOR UPDATE;
  SELECT * INTO v_request FROM public.booking_cancellation_requests
    WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Pending cancellation request not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_reviewer = v_request.passenger_id THEN
    RAISE EXCEPTION 'A passenger cannot review their own cancellation request.' USING ERRCODE = '42501';
  END IF;

  IF NOT private.is_hanyago_staff()
     AND NOT (v_booking.company_id IS NOT NULL AND private.is_company_manager(v_booking.company_id)) THEN
    RAISE EXCEPTION 'You are not authorized to review this cancellation.' USING ERRCODE = '42501';
  END IF;

  IF p_decision = 'reject' THEN
    UPDATE public.booking_cancellation_requests
      SET status='rejected', reviewed_at=now(), reviewed_by=v_reviewer,
          review_note=nullif(btrim(p_review_note),'')
      WHERE id=p_request_id AND status='pending';
    RETURN FOUND;
  END IF;

  IF v_booking.status NOT IN ('pending','confirmed','assigned') THEN
    RAISE EXCEPTION 'Booking state has changed; cancellation cannot be approved.' USING ERRCODE = '22023';
  END IF;

  IF v_booking.scheduled_departure_id IS NOT NULL THEN
    PERFORM s.id FROM public.scheduled_departure_seats s
      WHERE s.booking_id=v_booking.id AND s.status IN ('held','booked')
      ORDER BY s.seat_number FOR UPDATE;
    SELECT count(*)::integer INTO v_seat_count FROM public.scheduled_departure_seats
      WHERE booking_id=v_booking.id AND status IN ('held','booked');
    IF v_booking.status IN ('confirmed','assigned') AND v_seat_count <> v_booking.passenger_count THEN
      RAISE EXCEPTION 'Seat allocation does not match passenger count; requires manual reconciliation.' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.scheduled_departure_seats
      SET status='available', booking_id=NULL, hold_expires_at=NULL, updated_at=now()
      WHERE booking_id=v_booking.id AND status IN ('held','booked');
  END IF;

  UPDATE public.bookings SET status='cancelled', updated_at=now()
    WHERE id=v_booking.id AND status IN ('pending','confirmed','assigned');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking cancellation failed due to state change.' USING ERRCODE = '40001';
  END IF;

  UPDATE public.booking_cancellation_requests
    SET status='approved', reviewed_at=now(), reviewed_by=v_reviewer,
        review_note=nullif(btrim(p_review_note),'')
    WHERE id=p_request_id AND status='pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request review state changed; transaction aborted.' USING ERRCODE = '40001';
  END IF;

  -- Refund processing is deliberately separate; payment rows are not modified here.
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.withdraw_booking_cancellation(p_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to withdraw a request.' USING ERRCODE = '28000';
  END IF;
  UPDATE public.booking_cancellation_requests
    SET status='withdrawn', withdrawn_at=now()
    WHERE id=p_request_id AND passenger_id=auth.uid() AND status='pending';
  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.request_booking_cancellation(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_booking_cancellation(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.withdraw_booking_cancellation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_booking_cancellation(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_booking_cancellation(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_booking_cancellation(uuid) TO authenticated;

COMMIT;
