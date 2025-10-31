# Epic: Payroll (Employee-Centric, PKR, Breakdown, Medical)

## Goal
Enable HR to manage per-employee salary profiles in PKR with explicit breakdown and generate payslips per employee/month; track monthly medical amounts. Month summaries and exports are vNext.

## In Scope (MVP)
- Salary Profiles (PKR) with effective-dated entries and breakdown fields:
  - basic pay, gym allowance, food allowance, fuel allowance, tax per month
- Employee-centric payslip generation:
  - Generate a payslip for a selected employee and month (YYYY-MM); idempotent per employee+month
- Medical tracking per employee per month (amount PKR, optional note)
- UI: Payroll page lists employees; selecting one opens payroll detail with current salary, history, medical, recent payslips, and a "Generate Payslip" button

## Out of Scope (vNext)
- Bulk month runs and ZIP/PDF/CSV exports (month summary view)
- Complex tax/benefits engines; bank integrations

## Key Outcomes
- Accurate, PKR-based payslips per employee with clear breakdown and medical tracked per month

## User Stories (HRW-PAY-1..5)
- HRW-PAY-1: Manage Salary Profiles (PKR breakdown)
- HRW-PAY-2: Payroll Employee List + Detail
- HRW-PAY-3: Generate Payslip (Per Employee, per month)
- HRW-PAY-4: Medical Tracking (monthly per employee)
- HRW-PAY-5: Payslip Listing & Export (vNext)

## Acceptance Criteria
- Salary profile amounts are non-negative PKR; effective_from month is required; unique (employee, effective_from)
- Payslip net = (basic + gym + food + fuel) - tax; idempotent per (employee, month)
- Medical entries unique per (employee, month); amounts are PKR; optional note
- UI shows employee list and detail pane with current salary breakdown, history, medical list, and recent payslips

## Dependencies
- Employees module; PDFKit helper (for vNext PDFs); exports utility (vNext)

## Non-Functional
- Deterministic calculation for a given month; consistent currency formatting for PKR

## Metrics
- Time to generate an employee payslip; adoption of salary profile updates

## Risks
- Data consistency when updating profiles mid-month (resolved via effective_from month semantics)
- Legacy DB constraints; add reconcile migrations

## Release Slices
- MVP: salary profiles (breakdown), medical tracking, per-employee payslip generation, employee list/detail UI
- vNext: monthly summaries and PDF/ZIP/CSV exports; bank export formats

