# HanyaGo Intercity Operations Guide

## Purpose

Use the intercity workflow for scheduled coaches and scheduled shuttles that depart from a known terminal. Use the existing local booking flow for Keke Napep, local pickup/drop-off, private-car requests and other flexible journeys. Do not mix the two inventory types.

Public route suggestions are **search shortcuts, not promises that a bus runs on a particular date**. The live search must remain empty until a real departure has been checked and published. Never seed fake schedules, fares, operators, terminals, ratings or seats to make the website look busier.

## Route research: North-East corridors

The Federal Ministry of Works' HDMI Phase II corridor listing identifies these relevant road corridors:

- **Gombe–Biu (F129):** official corridor description identifies Gombeline Motorpark, Gombe, through several communities to Biu Township. The Ministry's technical page reports the corridor as 126 km, while a later government project announcement describes a 125 km dualisation project. Treat those as published road-project measurements, not passenger fares or guaranteed journey times.
- **Biu–Numan (A4).**
- **Numan–Jalingo (A4).**
- **Yola–Gombe (A345).**

Official references: [Federal Ministry of Works, Biu–Gombe technical detail](https://hdmi.fmw.gov.ng/user/hdmi/corridor/6/technical-detail), [HDMI Phase II road corridors](https://hdmi.fmw.gov.ng/user/hdmi/corridors), [FRSC RTSSS terminal directory](https://rtsss.frsc.gov.ng/service/terminals).

These official road listings help operations prioritise research. **They do not prove that a named bus operator serves the route, that a service runs daily, that a particular terminal is operating, or what its current ticket price is.** Confirm every actual timetable with the operator/terminal before publishing. Before travelling, check current road and safety information separately.

## Create and publish a departure

1. Sign in with an account that has the existing authorised HanyaGo `admin` or `operator` role. The intercity operations page is restricted; a link alone does not grant permission.
2. Open **Intercity departures & seats** from the main operations console.
3. Enter the operator's real public name and, only with permission, an actual booking/contact phone number.
4. Enter the departure town, state and exact terminal/motor-park name. Enter the destination town, state and exact arrival terminal. A town name alone is not a terminal.
5. Verify departure date and local Nigeria time with the operator. Add an arrival estimate only when the operator can support it; do not guess the arrival time.
6. Select the actual service type, vehicle/coach type, physical passenger-seat capacity, arrangement (2+2, 2+1 or 2+3) and ticket price **per passenger seat in naira**. The system stores prices in kobo internally.
7. Add a real HTTPS vehicle photo only when it genuinely depicts the listed vehicle or a clearly labelled representative vehicle. Tick only amenities that are confirmed. State actual luggage restrictions and extra charges.
8. Record the source used to confirm the operator, terminal, vehicle and schedule in the operations evidence note. Then use **Verify & publish** only after the human review is complete.

The “HanyaGo staff-checked” badge means HanyaGo staff reviewed the entered record. It is **not** proof of FRSC registration, roadworthiness, insurance, a company licence or government endorsement. Where appropriate, check the operator and terminal against the [FRSC RTSSS portal](https://rtsss.frsc.gov.ng/) and store what was checked. Do not display an FRSC badge unless the relevant details have actually been independently verified.

## Seats and inventory

- Capacity and layout should match the physical vehicle, not a convenient guess. The system generates numbered seats from that configuration.
- Passengers can select up to eight seats per booking. Available seats can be selected; held, booked and blocked seats cannot.
- A reservation uses a database transaction to recheck the selected seats and holds them temporarily for 15 minutes.
- The operations page may block/reopen unbooked seats for a genuine vehicle-layout or maintenance reason. Held/booked seats are locked to stop casual reassignment.
- If a vehicle is swapped, first make sure its actual seating/capacity is compatible. The current layout is fixed after the inventory is created; for a different layout, create a replacement departure rather than silently changing the old seat map.

## Passenger and ticket rules

- Ask for the passenger's actual name and a reachable passenger phone number. The person paying/arranging the trip may be different from the person travelling.
- When someone books for another passenger, record the relationship. If the correct relationship is not listed, select **Other** and write it clearly.
- Public search must show actual fare per seat, terminal at each end, departure time and seats available, without exposing another passenger's personal details.
- The booking reference and 15-minute seat hold are not a paid ticket.
- Paystack's server-side verification/webhook must confirm the payment before the seat is marked booked and the ticket can display **PAID · CONFIRMED**.
- The printed e-ticket contains an opaque verification code and QR to the live HanyaGo verifier. The public verifier must not disclose passenger names, phone numbers or payment account data. A screenshot alone can be copied; staff should scan/check the live verifier.
- If the provider reports a successful payment but HanyaGo cannot confirm the seat, do not tell the passenger to pay again. Save the payment reference, alert operations and resolve the seat/refund or re-accommodation.

## Cancellation, refunds and record keeping

Before marking a published trip cancelled, review its upcoming bookings and successful payments. Contact affected passengers and follow the applicable refund or re-accommodation policy. Cancelling a departure in the database does not itself refund money or notify all passengers.

For every departure, keep the actual operator/contact, terminal names, fare source, date/time confirmation, vehicle/capacity confirmation, staff reviewer and any changes. Do not put identity documents or unnecessary personal data in the public notes or evidence field.

## Access control and post-migration checks

- Public visitors may search eligible published schedules, see safe seat-state labels, and validate an opaque ticket code. They must not read private bookings or directly modify seat inventory.
- Signed-in passengers may reserve seats through the guarded reservation RPC and retrieve their own ticket record only.
- Schedule creation/publication and seat blocking are restricted by database row-level security to HanyaGo staff or an authorised company owner/admin.
- Payment confirmation and hold-lifecycle RPCs are service-role-only; never call them from browser JavaScript or expose a service-role key.
- After every SQL function migration, audit the effective privileges for the three main roles (`anon`, `authenticated`, `service_role`). A generic revoke does not remove every possible explicit role grant that may pre-date the migration. Public search/seat-status/public ticket verification are intentional anonymous functions; reservation and owner-ticket lookup must not be anonymously executable; payment confirmation/hold lifecycle must be service-role-only.
- If an operator account cannot create a departure, verify that the user has an active `owner` or `admin` membership in the correct `transport_company_members` record. The company must also be active and license-approved before a company-linked departure can be published. Do not bypass the database policy to make a form appear to work.

## Pre-launch checks

- [ ] The operator and terminal were actually checked.
- [ ] A real future date/time and route have been confirmed with the operator.
- [ ] The fare shown is the approved fare per seat.
- [ ] Physical capacity and seat layout match the vehicle.
- [ ] The correct seats are available in the database and duplicate-seat races are rejected.
- [ ] A controlled Paystack test verifies the amount/currency, blocks duplicate payment, confirms seats only once, and does not issue a paid ticket on a failed/pending transaction.
- [ ] Paid ticket page, print view and public QR verifier show matching records.
- [ ] Cancelled or changed trips have a passenger communication/refund plan.
- [ ] Mobile and slow-network behaviour has been checked.

**Current setup note:** the database presently has no published intercity departures. This is intentional; operations must add genuine records before public search returns trips. The frontend and backend code are connected, but do not treat the system as ready for public paid journeys until a controlled end-to-end payment and ticket verification test passes.
