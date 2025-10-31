# HRWays — Architecture

## System Overview
- Full‑stack HR operations app with ADMIN and HR roles.
- Client: React + TypeScript (Vite), Tailwind CSS, Redux classic store, axios, React Router.
- Server: Node.js + Express, PostgreSQL via `pg` (raw SQL), JWT auth, email‑based OTP password reset.
- Files: HR documents stored in DB (`bytea`); CSV/PDF exports streamed to client (browser saves to Downloads).
- Notifications: in‑app list + daily scheduler for birthdays and work anniversaries.

## High‑Level Architecture
- Web Client (SPA) communicates with REST APIs over HTTPS.
- Server layers per module:
  - Router → Controller → Service → Repo (SQL) → DB
  - Shared: error handler, auth guard, input validation, pagination helpers.
- Background scheduler for time‑based notifications (cron at org timezone).

## Repository Structure (target)
```
hrways/
  client/                     # React app (Vite + TS + Tailwind)
  server/                     # Express + PostgreSQL
    src/
      index.ts
      config/
        env.ts                # loads env, ORG_TZ, SMTP, JWT, DB
        db.ts                 # pg Pool
        auth.ts               # JWT helpers
        email.ts              # SMTP transport + templates (OTP)
        scheduler.ts          # cron bootstrap
      middleware/
        authGuard.ts
        errorHandler.ts
      utils/
        csv.ts                # CSV streaming helper
        pdf.ts                # PDFKit helper
        pagination.ts
      modules/
        users/
          router.ts
          controller.ts
          service.ts
          repo.ts
        notifications/
          router.ts
          controller.ts
          service.ts
          repo.ts
          scheduler.ts        # birthday/anniversary logic
        employees/
          router.ts
          controller.ts
          service.ts
          repo.ts
          documents.ts        # memory upload → DB bytea
        attendance/
          router.ts
          controller.ts
          service.ts
          repo.ts
        leave/
          router.ts
          controller.ts
          service.ts
          repo.ts
        meetings/
          router.ts
          controller.ts
          service.ts
          repo.ts
        payroll/
          router.ts
          controller.ts
          service.ts
          repo.ts
      routes.ts               # compose module routers
    migrations/               # versioned .sql files
    .env.example              # config template
```

## Database Schema (outline)
- Conventions: snake_case tables/columns; `id` UUID PKs; `created_at/updated_at` timestamptz where relevant; enums as `text` with CHECK or dedicated enum types.

Users
- `users(id, email unique, password_hash, role text CHECK (role IN ('ADMIN','HR')), preferences jsonb, created_at)`
  - `preferences` keys include: `theme` ('light'|'dark'), `brandVariant` ('emerald'|'blue'|'orange'|'violet'|'rose'), `language`, `timezone`, optional `textScale`.

Notifications
- `notifications(id, user_id FK users, type text, message text, related_employee_id UUID NULL, metadata jsonb NULL, read boolean default false, created_at)`
- Index: `(user_id, read)`; optional `(created_at DESC)`
- Types include: `SYSTEM`, `BIRTHDAY`, `WORK_ANNIVERSARY`, etc.

Employees
- `employees(id, code unique, name, email unique, phone, department, title, status text, join_date date, birth_date date, created_at)`

Employee Documents (DB‑backed)
- `employee_documents(id, employee_id FK employees, original_filename, mime, size int, content bytea, sha256 text NULL, uploaded_at)`

Attendance
- `attendance(id, employee_id FK, work_date date, clock_in timestamptz NULL, clock_out timestamptz NULL, status text, created_at)`
- Unique: `(employee_id, work_date)`

Leave Requests
- `leave_requests(id, employee_id FK, type text, date_from date, date_to date, reason text, status text, created_at)`

Meetings
- `meetings(id, title, start_at timestamptz, end_at timestamptz, location text, organizer_user_id FK users, created_at)`

Meeting Attendees
- `meeting_attendees(meeting_id FK, attendee_user_id FK NULL, attendee_employee_id FK NULL, external_name text NULL, external_email text NULL, external_phone text NULL)`
- Uniqueness: prevent duplicates per meeting across attendee types
  - Unique (meeting_id, attendee_user_id) WHERE attendee_user_id IS NOT NULL
  - Unique (meeting_id, attendee_employee_id) WHERE attendee_employee_id IS NOT NULL
  - Unique (meeting_id, lower(external_email)) WHERE external_email IS NOT NULL

Salary Profiles
- `salary_profiles(id, employee_id FK, base numeric(12,2), allowances numeric(12,2) default 0, deductions numeric(12,2) default 0, effective_from date, created_at)`

Payroll Runs
- `payroll_runs(id, run_month date, status text, created_at)`

Payslips
- `payslips(id, payroll_run_id FK, employee_id FK, gross numeric(12,2), net numeric(12,2), breakdown jsonb, generated_at)`

Password Reset (email + OTP)
- `password_reset_requests(id, user_id FK, hashed_otp text, expires_at timestamptz, attempts int default 0, used_at timestamptz NULL, created_at)`
- `password_reset_tokens(id, user_id FK, request_id FK, hashed_token text, expires_at timestamptz, used_at timestamptz NULL, created_at)`

## Scheduler Design (Birthdays & Anniversaries)
- Config: `ORG_TZ` (IANA timezone), `SCHEDULE_TIME` (e.g., 09:00)
- Implementation: `node-cron` (or `cron`), runs daily at org local time.
- Logic:
  - Birthdays: `to_char(birth_date, 'MM-DD') = to_char(now() AT TIME ZONE ORG_TZ, 'MM-DD')`
  - Work anniversaries: same for `join_date` where `age(today, join_date) >= 1 year`
  - Create one notification per employee/event/day; attach `related_employee_id`, metadata `{ years }`.

## Auth & Security
- JWT access token (short‑lived), optional refresh rotation.
- Password hashing with bcrypt.
- Email OTP Reset flow:
  - `POST /auth/request-reset` → always 202; generate OTP; email via SMTP; store hashed OTP + TTL + attempts.
  - `POST /auth/verify-reset-otp` → returns short‑lived reset token on success.
  - `POST /auth/reset` → set new password; single‑use token.
- RBAC: route‑level guards; roles `ADMIN`, `HR`.
- Validation: sanitize inputs; enforce file upload size/type; parameterized SQL only.
- Rate limits: reset endpoints.

## API Surface (intent → endpoints)
Auth
- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- `POST /auth/request-reset`, `POST /auth/verify-reset-otp`, `POST /auth/reset`

Users / Preferences / Notifications
- `GET /me`, `GET /me/preferences`, `PUT /me/preferences`
  - `PUT /me/preferences` accepts optional `brandVariant` from the approved set; invalid values are rejected.
- `GET /notifications`, `POST /notifications/mark-read`, `POST /notifications/mark-all-read`

Employees
- `POST /employees`, `GET /employees`, `GET /employees/:id`, `PUT /employees/:id`, `PATCH /employees/:id/archive`
- Documents: `POST /employees/:id/documents`, `GET /employees/:id/documents`, `GET /employees/:id/documents/:docId/download`, `DELETE /employees/:id/documents/:docId`
- Export: `GET /employees/export.csv`

Attendance & Leave
- Attendance: `POST /attendance`, `GET /attendance`
- Leave: `POST /leave-requests`, `GET /leave-requests`, `PATCH /leave-requests/:id/approve`, `PATCH /leave-requests/:id/reject`
- Export: `GET /attendance/export.csv`, `GET /attendance/summary.pdf`

Meetings
- `POST /meetings`, `GET /meetings`, `GET /meetings/:id`, `PUT /meetings/:id`, `DELETE /meetings/:id`
- Export: `GET /meetings/export.csv`

Payroll
- Salary profiles: `PUT /payroll/salary-profiles/:employeeId`
- Runs: `POST /payroll/runs`, `GET /payroll/runs`
- Payslips: `GET /payslips/:id.pdf`, `GET /payroll/runs/:id/payslips.zip`, `GET /payroll/export.csv`

Dashboard
- `GET /dashboard/metrics`, `GET /dashboard/recent`

## Error Shape & Pagination
- Errors: `{ error: { code, message, details? } }`
- Pagination: `?page=1&pageSize=20&sort=...`; response `{ data, page, pageSize, total }`

## Exports & Documents
- CSV: stream with `Content-Type: text/csv`, `Content-Disposition: attachment; filename="..."`
- PDF: PDFKit pipeline to `res` (payslips, attendance summaries)
- Uploads: multer `memoryStorage()`; insert `req.file.buffer` into `employee_documents.content` (bytea)

## Configuration (.env)
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_TTL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
- `ORG_TZ` (e.g., `America/New_York`), `SCHEDULE_TIME` (e.g., `09:00`)
- `MAX_UPLOAD_MB` (e.g., 10), `ALLOWED_MIME` (CSV/pdf/docx/png/jpg)

## Migrations Strategy
- Versioned SQL files in `server/migrations` with a small Node runner tracking a `schema_migrations` table.
- Baseline: users, notifications, employees, employee_documents, attendance, leave_requests, meetings, meeting_attendees, salary_profiles, payroll_runs, payslips, password_reset_requests, password_reset_tokens.

## Observability & Ops
- Logging: request ID, method, path, latency; omit secrets.
- Health: `/healthz` returning DB connectivity status.
- Rate limiting: apply on auth reset routes and exports.
- Backups: regular DB backups (uploads are in DB).

## Deployment Notes
- Dev: Docker Compose for Postgres recommended; SMTP can be a test container or external.
- Prod: Configure HTTPS termination, secure cookies if using cookie transport, rotate JWT secrets when needed.

---
This document reflects decisions in docs/brief.md and docs/prd.md and is intended to guide scaffolding and implementation.
