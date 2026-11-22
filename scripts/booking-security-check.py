#!/usr/bin/env python3
"""Static regression guard for the scheduled-seat identity gate migration."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
migration_files = sorted(
    ROOT.glob("supabase/migrations/*enforce_identity_gate_in_scheduled_reservations.sql")
)
if not migration_files:
    print("FAIL: identity-gate reservation migration is missing.")
    raise SystemExit(1)

sql = migration_files[-1].read_text(encoding="utf-8").lower()
checks = {
    "reservation RPC name": "create or replace function public.reserve_scheduled_seats(" in sql,
    "SECURITY DEFINER declaration": "security definer" in sql,
    "explicit identity helper call": "if not private.hanyago_identity_requirements_met(v_user_id) then" in sql,
    "identity rejection message": "identity verification must be approved before booking" in sql,
    "identity gate appears before booking insert": (
        sql.find("if not private.hanyago_identity_requirements_met(v_user_id) then") >= 0
        and sql.find("if not private.hanyago_identity_requirements_met(v_user_id) then")
        < sql.find("insert into public.bookings")
    ),
}
for label, passed in checks.items():
    print(f"{'PASS' if passed else 'FAIL'}: {label}")
if not all(checks.values()):
    raise SystemExit(1)
print("Static identity-gate regression checks passed. (This does not replace live database tests.)")
