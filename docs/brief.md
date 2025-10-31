# HRWays — Project Brief (MVP v1.1)

## Summary
- Purpose: A focused HR operations web app that helps HR teams manage employees, attendance/leave, meetings/scheduling, and payroll with strong RBAC and export capabilities.
- Users: ADMIN and HR only. No employee logins in MVP.
- Value: Streamlines routine HR workflows, centralizes records, and provides exports (CSV/PDF) with a pragmatic, lightweight stack.

## Problem & Vision
- Problem: Small to mid‑size teams lack a simple, cohesive HR tool for core operations without enterprise overhead.
- Vision: A pragmatic, modular PERN‑style solution that covers the essentials well and scales incrementally.

## Goals (MVP)
- Secure auth with ADMIN/HR roles and RBAC‑gated UI and APIs.
- Employees CRUD, file storage for documents, and searchable listings.
- Attendance and leave tracking recorded by HR (employees are records, not users).
- Meetings scheduling for management with internal notifications.
- Payroll (employee-centric, PKR): manage per-employee salary profiles with breakdown (basic, gym, food, fuel, tax), generate payslips per employee per month, and track monthly medical received (exports vNext).
- Usable UI with theming (light/dark) and in‑app notifications.

## Non‑Goals (MVP)
- No employee self‑service portal or login.
- No external calendar sync (Google/Outlook). No general email notifications (email used only for password reset OTP).
- No complex tax/benefits engines or bank integrations.

## Roles & Permissions
- ADMIN: System‑level configuration; has all HR capabilities by default.
- HR: Operational tasks across Employees, Attendance/Leave, Meetings, Payroll.

## Modules & Key Behaviors
1) Core Framework
   - Auth: login/refresh/logout; JWT handling; role‑based UI gates.
   - RBAC: route guards, policy checks.
   - Password reset: email-based OTP verification leading to a short-lived reset token; single-use with TTL and limited attempts.
   - Global Search & Filters: shared query DTO (`q`, `filters`, pagination).
   - Export: CSV/PDF generation per resource.
   - Theming: light/dark toggle persisted.
   - Scheduled notifications: daily birthdays and work anniversaries (timezone-aware).
   - Notifications: in‑app list, unread counts, mark read/all‑read.

2) Employees Management
   - Create/read/update/archive employees; unique employee code & email.
   - Upload/list/delete documents (CVs, contracts) stored in DB (bytea).
   - Search/filter/paginate; export CSV.

3) Attendance & Leave
   - HR records attendance (clock‑in/out or timesheet entries) and manages leave requests.
   - Summaries by date range; exports CSV and PDF.

4) Meetings & Scheduling (basic)
   - Create/update/cancel meetings; attendees can be employees, internal users (API), and/or external contacts.
   - External contacts: name required; email/phone optional; duplicates prevented by email when provided.
   - UI (MVP): Internal tab selects employees (multi-select search); External tab captures a single external contact.
   - Calendar UX: Default Month view; click day opens a day list; click meeting opens a details drawer; cancel from modal/drawer.
   - Notifications: in-app notifications on cancel (create/update are vNext); external calendar sync deferred.

5) Payroll & Finance
   - PKR currency across UI and storage.
   - HR manages per-employee salary profiles with breakdown (basic, gym, food, fuel, tax) via effective-dated entries; update anytime.
   - Generate payslip per employee for a selected month (idempotent).
   - Track monthly medical received per employee (amount + optional note).
   - Month summaries and exports are vNext.

6) Dashboard
   - KPIs: total employees, on leave today, pending approvals, meetings this week.
   - Recent activity and notifications.

7) Settings / Account
   - Profile view/update, password change, theme/preferences.

## Architecture at a Glance
- Monorepo with separate client (Vite React TS) and server (Express + PostgreSQL).
- Client: React + TypeScript, Tailwind CSS, Redux classic store (reducers/actions/thunks), axios, React Router.
- Server: Node.js + Express; `pg` for database access; raw SQL preferred (see Migrations).
- Auth: JWT (short‑lived access) + optional refresh rotation; HTTP‑only cookie or header.
- Notifications: in‑app via API polling or lightweight server push (vNext).
- Exports: server‑side CSV generation; PDFKit for PDFs.

## Tech Decisions (Locked)
- Roles: ADMIN, HR; no employee login.
- DB Access: Prefer raw SQL via `pg`. Remain open to Prisma if complexity grows.
- PDFs: PDFKit.
- File Storage: Uploads stored in DB (`bytea`) always; exports (CSV/PDF) are streamed to the client for download (no persistent disk writes). Browser saves to user’s default Downloads folder.
- Styling: Tailwind CSS (class strategy for dark mode).

## Migrations (Proposal)
- Minimal approach: directory of versioned `.sql` files with a tiny Node runner to apply up/down in a `migrations` table (keeps raw SQL pure).
- Alternative (if needed later): adopt `node-pg-migrate` while still writing mostly raw SQL.
- Auth reset tables: `password_reset_requests` (hashed_otp, ttl, attempts) and `password_reset_tokens` (hashed_token, ttl, single-use).

## Conceptual Data Model (high level)
- User: id, email (unique), password_hash, profile, preferences (JSON: theme, locale, timezone).
- Notification: id, user_id (FK), type, message, read, created_at.
- Employee: id, code (unique), name, email (unique), phone, department, title, status, join_date, birth_date.
- EmployeeDocument: id, employee_id (FK), original_filename, mime, size, content (bytea), uploaded_at, sha256 (optional).
- Attendance: id, employee_id (FK), work_date, clock_in, clock_out, status.
- LeaveRequest: id, employee_id (FK), type, date_from, date_to, reason, status.
- Meeting: id, title, start_at, end_at, location, organizer_user_id (FK).
- MeetingAttendee: meeting_id, attendee_user_id (nullable), attendee_employee_id (nullable).
- SalaryProfile: id, employee_id (FK), base, allowances, deductions, effective_from.
- PayrollRun: id, run_month, status, created_at.
- Payslip: id, payroll_run_id (FK), employee_id (FK), gross, net, breakdown (JSON).
- PasswordResetRequest: id, user_id, hashed_otp, expires_at, attempts, used_at, created_at.
- PasswordResetToken: id, user_id, hashed_token, expires_at, used_at, created_at, request_id.

Relationships & Indexing
- Notification N:1 User; index on `notifications.user_id`.
- Employee unique constraints on `code` and `email`.
- Attendance: unique (employee_id, work_date).
- MeetingAttendee supports many‑to‑many; indexes on meeting and attendee refs.

## API Actions (Intents)
- Core/Auth: register admin, login, refresh, logout; password reset (request OTP, verify OTP, reset); preferences read/update; notifications list/mark read/all.
- Employees: create/update/archive; list/search with filters/pagination; documents upload/list/delete; export CSV.
- Attendance & Leave: clock‑in/out record; list/filter by date; create/approve/reject leave; export CSV/PDF.
- Meetings: create/update/cancel; list/filter by date/attendees; export CSV.
- Payroll: upsert salary profile; execute payroll run; list/search payroll & payslips; export CSV and ZIP/PDF.
- Dashboard: fetch KPIs and recent activity.
- Notifications Scheduler: daily birthdays and work anniversaries (timezone-aware).

## Security & Compliance (MVP)
- Bcrypt password hashing; strict JWT handling and rotation.
- RBAC enforcement at route and UI levels (ADMIN vs HR).
- File uploads: sanitize filenames; enforce size/type limits; antivirus vNext.

## Client Application Structure
- Store: classic Redux (reducers/actions/thunks), typed hooks.
- Features: employees, attendance, meetings, payroll, settings.
- Shared UI: Sidebar, Topbar (search, filters, export, notifications, theme toggle).
- Routes: Dashboard, Employees, Attendance, Meetings, Payroll, Settings.
- Theming: Tailwind dark mode via class; persist theme in localStorage.

## Server Application Structure
- `config/`: env, db (`pg` pool), auth helpers.
- `middleware/`: `authGuard`, `errorHandler` with a standard error shape.
- `modules/`: employees, attendance, meetings, payroll, notifications, users.
- `routes.ts`: composed routes per module (generated by agent during buildout).

- ## Branding & UX Notes
- Brand gradients palette for CTAs, active nav, and highlights:
  - emerald (default): `bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500`
  - blue: `bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-500`
  - orange: `bg-gradient-to-br from-amber-500 via-orange-500 to-red-500`
  - violet: `bg-gradient-to-br from-fuchsia-500 via-violet-500 to-purple-500`
  - rose: `bg-gradient-to-br from-rose-500 via-pink-500 to-rose-700`
  - Persist user selection in preferences as `brandVariant`; default `emerald`.
- Neutral grayscale for content surfaces; emphasis on clarity and density for data tables.
- Accessibility and performance considered in Stabilize phase.

## Testing Strategy
- Server: Jest + Supertest focusing on action contracts.
- Client: Vitest + React Testing Library for reducers, thunks, and key components.

## Milestones (from Roadmap)
1. Milestone A (Bootstrap)
   - Auth (ADMIN/HR), RBAC guards, theme toggle & persistence, notifications shell, layout.
2. Milestone B (Employees)
   - Employees CRUD, search/filter/paginate, document storage, CSV export.
3. Milestone C (Attendance/Leave)
   - Attendance + leave flows, summaries, CSV/PDF export.
4. Milestone D (Meetings)
   - Basic scheduling and notifications.
5. Milestone E (Payroll, employee-centric)
   - Employee-centric payroll in PKR: profiles with breakdown, per-employee payslips, medical tracking; exports in vNext.
6. Stabilize
   - Tests, performance, accessibility.

## Initial Backlog (Execution‑Ready)
- Repo bootstrap: initialize monorepo folders `client/` and `server/` per structure.
- Client setup: Vite (React TS), Tailwind, Redux store, Router, axios base client.
- Server setup: Express app, CORS/JSON middleware, error handler, JWT helpers, `pg` pool.
- Migrations: create minimal runner and baseline schemas for Users, Employees, Documents, Attendance, Leave, Meetings, Payroll tables.
- Auth: admin seeding script, login/refresh/logout endpoints; authGuard middleware; role policies.
- Notifications: model + endpoints; client slice and UI bell with unread count.
- Theming: toggle and persistence; global styles and brand gradient utilities.

## Risks & Mitigations
- Data model scope creep → Keep MVP entities minimal; add vNext fields via migrations.
- Raw SQL complexity → Encapsulate queries; consider moving to Prisma if complexity rises.
- Export performance on large datasets → Paginate and stream CSV; pre‑render batches for PDFs.
- File storage growth → Local first; plan S3 migration with a storage abstraction layer.

## Open Questions (vNext)
- Calendar sync provider(s): Google, Microsoft, CalDAV.
- ORM: Evaluate if/when to switch to Prisma/Knex for developer velocity.
- Multi‑tenant strategy: single vs multi‑tenant in future releases.

---

This brief distills `hrways_specs.md` into execution‑ready guidance for PM, Architect, and Dev. Use it as the “north star” for PRD creation, architecture documents, and scaffolding tasks.
