# HanyaGo Cancellation Workflow QA Matrix

**Status:** Draft QA plan only. No production database operations have been run.

## Preconditions
- Migration has been reviewed and applied only to an isolated disposable test database.
- Use dedicated passenger, staff, company-manager, and unrelated-user accounts.
- Seed disposable bookings and scheduled-seat rows. Never test by modifying live passenger records.
- Capture before/after snapshots of booking status, linked seat status/booking IDs, and payment records.

## Functional and authorization checks

| ID | Test | Expected |
|---|---|---|
| C-01 | Passenger requests own eligible pending booking with valid reason | Request created; booking remains unchanged |
| C-02 | Passenger requests own confirmed booking | Request created; booking and booked seats remain unchanged |
| C-03 | Empty / 4-character reason | Rejected |
| C-04 | 1,001-character reason | Rejected |
| C-05 | Passenger requests someone else's booking | Rejected; no request row |
| C-06 | Second pending request for same booking | Unique-index rejection; only one pending row |
| C-07 | Passenger withdraws own pending request | Status withdrawn; booking unaffected |
| C-08 | Passenger withdraws another passenger's request | No mutation |
| C-09 | Unauthorized user reviews request | Denied; all records unchanged |
| C-10 | Passenger tries to review own request | Denied |
| C-11 | Authorized reviewer rejects | Request rejected; booking and seats unchanged |
| C-12 | Authorized reviewer approves a confirmed intercity booking with seat count matching passengers | Booking cancelled; all linked held/booked seats released in same transaction |
| C-13 | Seat allocation count mismatches passenger count for confirmed booking | Approval aborts; booking, request, and seats remain unchanged |
| C-14 | Booking has completed or is in progress | Approval rejected; no seat release |
| C-15 | Approve after another reviewer already decided | Rejected as not pending |
| C-16 | Two reviewers race to decide same request | One decision wins; no duplicate cancellation |
| C-17 | Two requests race for one booking | Only one pending request accepted |
| C-18 | Approved cancellation with successful payment | Payment remains success; refund is not falsely marked complete |
| C-19 | Approved cancellation with no payment | No payment rows created or changed |
| C-20 | Withdrawal races with review | One terminal state wins; no inconsistent state |

## SQL review items before applying
- Verify helpers `private.is_hanyago_staff()`, `private.is_company_manager(uuid)`, and `private.is_company_member(uuid)` exist and are callable in SECURITY DEFINER context.
- Confirm the function owner has the required table rights and is subject to intended RLS bypass behavior.
- Confirm authenticated role cannot directly INSERT/UPDATE/DELETE cancellation requests.
- Confirm all three RPC signatures have EXECUTE denied to PUBLIC/anon and granted to authenticated.
- Verify schema migration uses the project's existing migration conventions and timestamps.
- Confirm company managers can review only company-linked bookings, and staff can review all intended bookings.
- Validate that payment/refund handling remains separate and that paid cancellations enter a reconciliation workflow.

## Release gate
Do not merge or apply this migration until it has been run against an isolated PostgreSQL database, syntax-checked, and the authorization/seat-release race cases above pass. No production mutation is authorized by this draft.
