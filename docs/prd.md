# HRWays — Product Requirements Document (PRD)

## 1. Overview
- Purpose: Deliver an MVP full‑stack HR operations app covering Employees, Attendance/Leave, Meetings, and Payroll with ADMIN/HR roles only.
- Source Inputs: docs/brief.md and hrways_specs.md.
- Outcome: Clear functional scope, acceptance criteria, NFRs, and milestone plan enabling immediate design and implementation.

## 2. Goals & Non‑Goals
- Goals
  - Secure RBAC (ADMIN/HR), JWT auth, and gated UI.
  - Operational workflows: Employees, Attendance/Leave, Meetings, Payroll.
  - Reliable exports: CSV and PDF via streaming downloads.
  - Usable UI with dark/light theme and in‑app notifications.
  - Password reset via email with OTP verification.
- Non‑Goals (MVP)
  - Employee self‑service portal, external calendar sync.
  - Advanced tax/benefits or bank integrations.
  - Multi‑tenant architecture.

## 3. Users & Roles
- ADMIN: System configuration and full HR capabilities.
- HR: Operational tasks for employees, attendance/leave, meetings, payroll.
- No employee login in MVP.

## 4. Success Metrics
- Time‑to‑task: Create employee < 30s; record attendance < 10s.
- Reliability: 99% successful CSV/PDF exports under 30s for 10k rows.
- Usability: Zero critical accessibility blockers on core flows.

## 5. Functional Scope (by Module)

### 5.1 Core Framework
- Auth
  - Login with email/password; bcrypt; short‑lived access JWT; refresh rotation.
  - Logout invalidates refresh context.
- RBAC
  - Route guards and policy checks for ADMIN/HR.
 - Password Reset (email + OTP)
  - User requests reset with email; system sends a one‑time OTP code via email (TTL, limited attempts).
  - User verifies OTP; on success, receives a short‑lived reset token.
  - User submits new password with the reset token to complete reset; both OTP and token are single‑use.
  - All events are audited.
- Preferences
  - Read/update theme, locale, timezone (stored in user preferences JSON).
- Notifications
  - List, mark read, mark all read.
- Scheduled Notifications
  - Daily job (org timezone) creates in-app notifications for birthdays and work anniversaries (years 8 1)
  - De-duplication: one notification per employee per event per day.
- Search & Filters
  - Standard DTO: `q`, `filters`, pagination (page, pageSize), sort.
- Export
  - Stream CSV and PDF with `Content-Disposition: attachment; filename="..."`.

Acceptance Criteria (Core)
- AC‑C1: A user with valid credentials can login and receives access token; protected endpoint returns 200.
- AC‑C2: HR cannot access ADMIN‑only endpoints (403), ADMIN can (200).
- AC‑C3: Notifications list returns unread count; marking read updates count.
- AC‑C4: CSV export triggers browser download with a suggested filename; no server temp files persist.
- AC‑C5: Requesting reset returns 202 regardless of email existence; a 6‑digit OTP is emailed (e.g., TTL 10 minutes, max 5 attempts).
- AC‑C6: Providing correct OTP yields a short‑lived reset token; incorrect OTP increments attempts and eventually locks the request.
- AC‑C7: Submitting new password with the reset token succeeds once; subsequent reuse fails; actions are recorded in audit logs.

Acceptance Criteria (Notifications — Scheduled)
- AC-N1: On a day matching an employee's birth_date, a BIRTHDAY notification is created for ADMIN/HR; no duplicates for the same employee/date.
- AC-N2: On a day matching an employee's join_date (years >= 1), a WORK_ANNIVERSARY notification is created with years included in metadata; no duplicates.
- AC-N3: The scheduler uses the configured organization timezone; behavior is consistent across DST.
- AC-N4: Notifications appear in the standard list and affect unread counts; marking read behaves consistently.

### 5.2 Employees Management
- Features
  - Create/read/update/archive employees; unique code and email.
  - Upload/list/delete employee documents; store content in DB (bytea).
  - Search/filter by name/email/department/status; paginate; CSV export.

Acceptance Criteria (Employees)
- AC‑E1: Creating employee with duplicate email or code fails with 409.
- AC‑E2: Uploading doc stores metadata and content in DB; download returns original filename and correct MIME.
- AC‑E3: List supports `q` and department filter; pagination yields stable total counts.
- AC‑E4: CSV export includes filters and column headers; row counts match current query.

### 5.3 Attendance & Leave
- Features
  - HR records attendance (clock‑in/out or timesheet entries); unique (employee, work_date).
  - Create/approve/reject leave requests; summaries by date range; CSV/PDF export.

Acceptance Criteria (Attendance/Leave)
- AC‑A1: Recording a second attendance for same employee/work_date fails with 409.
- AC‑A2: Leave request requires type and valid date range; approval state transitions are tracked.
- AC‑A3: CSV export reflects filters (date range, department) and totals.
- AC‑A4: PDF summary generated via PDFKit downloads successfully.

### 5.4 Meetings & Scheduling
- Features
  - Create/update/cancel meetings; attendees can be employees, internal users (API), and/or external contacts (guests).
  - External contacts: name required; email/phone optional; dedupe by email when provided.
  - UI: Default Month view calendar; click day opens day list; click meeting opens details drawer; cancel from modal/drawer.
  - UI: New Meeting modal with tabs — Internal (multi-select employee search) and External (single contact capture).
  - In‑app notifications on cancel (create/update in vNext); calendar sync is vNext.

Acceptance Criteria (Meetings)
 - AC-M1a: At least one attendee is required.
 - AC-M2a: Each attendee is one-of: employee_ref, user_ref, or external_contact { name (required), email (optional), phone (optional) }. Duplicates prevented by id (users/employees) and by normalized email for externals when provided.
 - AC-M3a: External contacts do not require a user account.
 - AC‑M1: Creating meeting requires title and start_at < end_at; organizer defaults to current HR when organizer column exists.
 - AC‑M2: Canceling a meeting generates in‑app notifications for internal user attendees (create/update notifications are vNext).
 - AC‑M3: Filter by date range and attendee works with pagination; GET /meetings/:id returns details including attendees grouped by type.

### 5.5 Payroll & Finance
- Features
  - Employee-centric payroll in PKR:
    - Per-employee salary profiles with breakdown fields: basic pay, gym allowance, food allowance, fuel allowance, tax per month (all PKR), effective from selected month; HR can update anytime by adding a new effective profile.
    - Generate payslip per employee for a selected month (YYYY-MM), idempotent for the same employee+month.
    - Track monthly medical received per employee (amount in PKR, optional note).
  - Month summaries and exports (CSV/PDF) are vNext.

Acceptance Criteria (Payroll)
- AC-P1: Salary profile create/update validates PKR amounts as non-negative; effective_from month is required; fields include basic, gym, food, fuel, tax (PKR).
- AC-P2: Generating a payslip for an employee+month uses the active profile (effective_from <= month) and computes: gross = basic + gym + food + fuel; net = gross - tax; saved as PKR with a breakdown JSON.
- AC-P3: Re-generating the same employee+month is idempotent (updates in place, not duplicate).
- AC-P4: Medical records: HR can create/list monthly entries per employee with amount (PKR) and optional note; month uniqueness enforced per employee.
- AC-P5 (vNext): Monthly payroll summary and exports (CSV/PDF) available from a month view.
### 5.6 Dashboard
- Features
  - KPIs: total employees, on leave today, pending approvals, meetings this week.
  - Recent activity and notifications.

Acceptance Criteria (Dashboard)
- AC‑D1: KPI cards reflect current data; updates after underlying mutations.
- AC‑D2: Activity list paginates and links to relevant records.

### 5.7 Settings / Account
- Features
  - View/update profile; change password; theme/preferences.

Acceptance Criteria (Settings)
- AC‑S1: Password change requires current password and meets policy.
- AC‑S2: Theme change persists to user preferences; rehydrated on login.

## 6. RBAC Matrix (MVP)
- ADMIN
  - Full access to all modules and settings.
- HR
  - Employees: CRUD + documents.
  - Attendance/Leave: full management.
  - Meetings: full management.
  - Payroll: run and export; cannot change system‑level settings.

## 7. Data Requirements
- Follow conceptual model in docs/brief.md.
- EmployeeDocument: store `content` as bytea; include `original_filename`, `mime`, `size`, optional `sha256`.
- Attendance: enforce unique (employee_id, work_date).
- PasswordResetRequest: `id`, `user_id`, `hashed_otp`, `expires_at`, `attempts`, `used_at`, `created_at` (never store raw OTP).
- PasswordResetToken: `id`, `user_id`, `hashed_token`, `expires_at`, `used_at`, `created_at`, `request_id` (links to verified OTP request).
 - Employee: add `birth_date` (date) for birthday scheduling.
 - Notification: support types `BIRTHDAY` and `WORK_ANNIVERSARY`; optional `related_employee_id`; optional `metadata` JSON (e.g., years).

## 8. API Contract Principles
- Consistent error shape: `{ error: { code, message, details? } }`.
- Pagination: `{ data, page, pageSize, total }`.
- Filtering: explicit query parameters; validated and sanitized.
- Downloads: `Content-Disposition: attachment; filename="..."`; filename derived from resource and timestamp.
- Auth reset endpoints (email + OTP):
-  - `POST /auth/request-reset` (public): body `{ email }` → always 202; creates OTP and sends email.
-  - `POST /auth/verify-reset-otp` (public): body `{ email, otp }` → returns `{ resetToken, expiresAt }` on success.
-  - `POST /auth/reset` (public): body `{ resetToken, newPassword }` → 200 on success; token becomes invalid.

## 9. Non‑Functional Requirements (NFRs)
- Security: bcrypt, JWT rotation, RBAC, input validation, parameterized SQL; OWASP top‑10 awareness.
- Security (reset): rate‑limit `request-reset`, `verify-reset-otp`, and `reset`; OTP random (6 digits or equivalent entropy), hashed at rest, single‑use; reset tokens hashed at rest; default TTLs (e.g., OTP 10m, reset token 15m).
- Email Delivery: SMTP or provider (e.g., SendGrid) configured; templated OTP email; do not leak user existence in responses.
- Performance: baseline p95 < 500ms for primary list endpoints at 10k rows (paginated).
- Reliability: idempotent exports; graceful error handling with standard shape.
- Accessibility: keyboard navigation, focus states, color contrast for core flows.
- Internationalization: store timezone/locale in preferences; date/time rendered per user settings.
- Observability: request logging (no secrets), basic error tracking, minimal health endpoint.
- Browser Support: latest Chrome/Edge/Firefox; responsive layout desktop‑first.

## 10. Downloads & Storage Behavior
- Uploads: HR documents stored in DB (bytea) via in‑memory upload; metadata persisted.
- Downloads: server streams CSV/PDF with attachment disposition; browser saves to user’s default Downloads folder (cannot force OS path from server).
- No persistent server‑side temp files for exports.

## 11. Validation & Error Scenarios
- Duplicate employee email/code → 409 Conflict.
- Invalid file type/size → 400 with details; no data stored.
- Unauthorized/forbidden → 401/403 consistent handling.
- Attendance duplicate for same day → 409 Conflict.
- Meeting invalid time range → 400.

## 12. Milestones & Backlog
- Milestone A: Auth, RBAC, theme, notifications shell, layout.
- Milestone B: Employees CRUD + docs + search/filter + CSV export.
- Milestone C: Attendance/Leave flows + CSV/PDF exports.
- Milestone D: Meetings basics + notifications.
- Milestone E: Payroll (employee-centric PKR): profiles with breakdown, per-employee payslips, medical tracking; exports vNext.
- Stabilize: tests, perf, accessibility.

Initial Backlog (top items)
- Express app bootstrapping, pg pool, authGuard, error shape.
- User/Notification schema + migrations; admin seed script.
- Employees schema + docs (bytea) and endpoints; client slice/UI.
- Export utilities: CSV stream helper; PDFKit wrapper.

## 13. Risks & Mitigations
- Large DB growth due to bytea docs → monitor sizes; consider external storage adapter later.
- Raw SQL complexity → encapsulate queries; unit test data layer.
- Export performance → stream, paginate, consider background jobs later.

## 14. Assumptions
- Single organization per deployment.
- Payroll rounding kept simple (2‑decimal currency) for MVP.
- Email is used only for password reset OTP in MVP (no other email features).

## 15. Open Questions
- Max upload size and allowed MIME types policy?
- Specific payroll components (allowances/deductions) list for MVP?
- Should we add audit logs for sensitive actions (vNext)?
 - Confirm OTP length (6 digits?) and TTL (10 minutes?), max attempts (e.g., 5), and reset token TTL (e.g., 15 minutes).

---

This PRD is derived from docs/brief.md and hrways_specs.md. It is implementation‑ready for the Architect/Dev to proceed with scaffolding and schema/migration planning.


