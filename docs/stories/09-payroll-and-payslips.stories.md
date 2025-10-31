# Epic: Payroll (Employee-Centric, PKR) — User Stories

## HRW-PAY-1: Manage Salary Profiles (PKR Breakdown)
- Role: HR
- Goal: Create/update an employee’s salary profile with breakdown (PKR): basic, gym, food, fuel, tax; effective from a selected month (YYYY-MM).
- Acceptance Criteria:
  - Non-negative PKR amounts; effective_from is required and normalized to month start.
  - Unique per (employee_id, effective_from); updates overwrite the same key.
  - GET employee payroll detail shows the current profile (latest effective <= today) and history list.
- DoD: Endpoint(s) for create/update; validation; DB uniqueness; list history.
- Dependencies: Employees
- Priority: P1 | Estimate: TBD

## HRW-PAY-2: Payroll Employee List + Detail
- Role: HR
- Goal: View employees with current salary snapshot; open detail to see salary breakdown/history, medical records, and recent payslips.
- Acceptance Criteria:
  - List endpoint paginates employees and includes current profile snapshot (PKR breakdown) where available.
  - Detail endpoint returns: current profile, history (effective_from list), medical by month (recent), recent payslips.
  - UI: Payroll page lists employees; selecting one opens the detail pane.
- DoD: List/detail endpoints; UI list + detail pane.
- Dependencies: HRW-PAY-1
- Priority: P1 | Estimate: TBD

## HRW-PAY-3: Generate Payslip (Per Employee)
- Role: HR
- Goal: From employee payroll detail, generate a payslip for a selected month (YYYY-MM).
- Acceptance Criteria:
  - Uses active profile where effective_from <= month; computes gross = basic+gym+food+fuel; net = gross - tax; stores PKR with breakdown.
  - Idempotent per (employee_id, month): re-running updates the existing payslip, not duplicate.
  - Returns consistent shape; errors follow standard error format.
- DoD: Endpoint; DB uniqueness per employee+month; calculation logic; UI button and month picker.
- Dependencies: HRW-PAY-1, HRW-PAY-2
- Priority: P1 | Estimate: TBD

## HRW-PAY-4: Medical Tracking (Monthly)
- Role: HR
- Goal: Record and view monthly medical received (PKR) per employee with optional note.
- Acceptance Criteria:
  - Unique per (employee_id, month); non-negative PKR; note optional.
  - List in employee payroll detail; editable entries (update/replace for same month).
- DoD: CRUD endpoints; UI section in detail pane.
- Dependencies: Employees
- Priority: P2 | Estimate: TBD

## HRW-PAY-5: Payslip Listing & Export (vNext)
- Role: HR/Admin
- Goal: List/filter payslips per employee and export summaries (CSV/PDF) for a month.
- Acceptance Criteria:
  - List supports month filter; export generates CSV/PDF with stable formatting (PKR, 2 decimals).
- DoD: List endpoint and exports; optional month summary view.
- Dependencies: HRW-PAY-3
- Priority: P3 | Estimate: TBD (vNext)

