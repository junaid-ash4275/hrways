# HRWays — Product Specs (BMAD) • MVP v1.1

> **HRWays**: A PERN-based HR utilities platform (Employees, Attendance/Leave, Meetings/Scheduling, Payroll).
>
> **Brand**: Primary gradient — `bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500`
>
> **BMAD Reminder**: BMAD agents will synthesize **endpoints, workflows, and concrete DB schemas** during implementation. This spec defines **behaviors, conceptual models, actions-as-intents, and data domains** only. No hard-coded REST paths or SQL DDL are committed here.

---

## 0) Architecture & Project Layout

**Monorepo with two independent apps** (separate `package.json` for each):

```
hrways/
  client/              # React app (Vite + TypeScript + Tailwind + Redux store)
    package.json
    src/
    index.html
    tailwind.config.ts
  server/              # Node.js + Express + PostgreSQL (ORM optional)
    package.json
    src/
    prisma/            # optional if using Prisma
  package.json         # optional root for shared scripts (no code)
  README.md
```

### Tech Choices
- **Frontend**: React + **Vite + TypeScript**, **Tailwind CSS** for styling, **Redux (classic store)** for global state (with `redux` + `react-redux`; middleware like `redux-thunk` or custom sagas optional). No Redux Toolkit / RTK Query.
- **Backend**: Node.js + **Express**, PostgreSQL; ORM optional (Prisma/Knex); validation library optional (Zod/Joi). 
- **Auth**: JWT-based with **two roles only**: `ADMIN` and `HR`. There is **no Employee user** role.
- **Notifications**: In-app (global store slice + server events).
- **Search/Filter**: Server-backed queries; client issues debounced requests.
- **Exports**: CSV/PDF generation handled server-side.
- **Theming**: Light/Dark via Tailwind class strategy + localStorage persistence.

### Create Apps
- **Preferred (Vite + TS):**
  ```bash
  npm create vite@latest client -- --template react-ts
  ```
- **Alternative (CRA, if required):**
  ```bash
  npx create-react-app hrways --template typescript
  ```
  Then move/rename into `client/` to fit the monorepo layout.

### Install & Init
```bash
# server
cd server && npm init -y && npm i express cors jsonwebtoken bcrypt pg multer
# optional ORM & validation (choose later; BMAD may scaffold)
# npm i -D prisma && npx prisma init
# npm i zod

# client
cd ../client && npm i redux react-redux axios react-router-dom
npm i -D tailwindcss postcss autoprefixer && npx tailwindcss init -p
```

### Tailwind Setup
- Enable dark mode via class strategy in `tailwind.config.ts`:
  ```ts
  export default {
    darkMode: 'class',
    content: ['./index.html','./src/**/*.{ts,tsx}'],
    theme: { extend: {} },
    plugins: [],
  }
  ```
- Primary brand utility: `bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500`.

---

## 1) BMAD Overview

We apply **BMAD (Behavior → Model → Action → Data)** **per module**, incrementally:
- **MVP**: minimum set required for value.
- **vNext**: planned increments.

> **Important**: In this spec:
> - **Action** = *intent-level operations* (what the agent should create), **not** fixed REST paths.
> - **Data** = *conceptual entities & relationships*, **not** SQL DDL.

Modules:
1. Core Framework (Auth, RBAC, Theming, Notifications, Search/Filter, Export)
2. Employees Management
3. Attendance & Leave
4. Meetings & Scheduling (no notes/agendas in MVP)
5. Payroll & Finance
6. Dashboard
7. Settings / Account

---

## 2) Core Framework (Cross-cutting)

### Behavior
- **Auth**: Sign-in/out; token refresh; role-based UI gating.
- **RBAC**: Only `ADMIN` configures system; `HR` performs operational tasks.
- **Global Search & Filters** across all modules.
- **Export** actions trigger CSV/PDF generation.
- **Theme** toggles persist (dark/light).
- **Notifications**: Real-time-ish in-app list with unread counts.

### Model (Conceptual)
- **Roles**: `ADMIN`, `HR`.
- **User**: email, password_hash, profile, preferences (theme, locale).
- **Notification**: id, type, message, read, user_id, created_at.
- **Search**: shared query DTO: `q`, `filters`, `pagination`.

### Action (Intents for BMAD to generate)
- Auth intents: register admin, login, refresh, logout.
- RBAC guard middleware and policy checks.
- Search endpoints per resource with pagination and filter parsing.
- Export generators for each resource (CSV/PDF/ZIP where applicable).
- Notifications list, mark-read, mark-all-read.
- Preferences read/update (theme, etc.).

### Data (Conceptual)
- Entities: `User`, `Notification`.
- Relationships: `Notification` → `User` (many-to-one).
- Indexing needs: quick lookup by `email`, and `notifications.user_id`.

---

## 3) Employees Management

### Behavior (MVP)
- `HR` and `ADMIN` can create/read/update/archive employees.
- Upload & manage employee documents (CVs, contracts).
- Search by name/email/department/status.

**vNext**: bulk import, custom fields, document expiry reminders.

### Model (Conceptual)
- **Employee**: code, name, email, phone, department, title, status, join_date.
- **EmployeeDocument**: file metadata, storage ref, uploaded_at.

### Action (Intents)
- Create/update/archive employee.
- Upload/list/delete employee documents.
- List/search employees with filters & pagination.
- Export employee list to CSV.

### Data (Conceptual)
- Entities: `Employee`, `EmployeeDocument`.
- Constraints: unique `employee_code`, unique `email`; soft-delete via status.

---

## 4) Attendance & Leave

### Behavior (MVP)
- Employees (as records, **not** users) have attendance tracked by `HR`.
- `HR` records clock-in/out or timesheets and manages leave requests.
- Summaries by date range; export CSV/PDF.

**vNext**: geofenced clock-in, calendar views, reminders.

### Model (Conceptual)
- **Attendance**: employee_ref, work_date, clock_in, clock_out, status.
- **LeaveRequest**: employee_ref, type, date_from, date_to, reason, status.

### Action (Intents)
- Clock-in/out (HR submission or device integration later).
- List/filter attendance by date range/department.
- Create/approve/reject leave requests.
- Export attendance (CSV/PDF).

### Data (Conceptual)
- Entities: `Attendance`, `LeaveRequest`.
- Constraints: one attendance record per employee per work_date.

---

## 5) Meetings & Scheduling (no notes/agendas in MVP)

### Behavior (MVP)
- `HR` books meetings for management/CEO.
- Store internally; calendar sync deferred.
- Notify attendees via in-app notifications.

**vNext**: Google/Outlook sync, recurring meetings, room resources.

### Model (Conceptual)
- **Meeting**: title, start_at, end_at, location, organizer (HR/Admin), attendees (employees, internal users, and/or external contacts).
  - External contact capture: { name (required), email (optional), phone (optional) }; no user account required.

### Action (Intents)
- Create/update/cancel meetings.
- List/filter meetings by date range/attendees.
- Export meetings list to CSV.

### Data (Conceptual)
- Entities: `Meeting`, `MeetingAttendee`.
- Relationship: many-to-many between meeting and humans (user, employee record, or external contact). Uniqueness: prevent duplicates per meeting by (user id), (employee id), and by normalized external email when provided.

---

## 6) Payroll & Finance

### Behavior (MVP)
- Maintain salary data per employee (records managed by `HR`).
- Process monthly payroll; generate payslips.
- Track reimbursements/expenses.
- Export payslips (PDF/ZIP) and payroll CSV.

**vNext**: tax rules, bonuses, bank integrations.

### Model (Conceptual)
- **SalaryProfile**: employee_ref, base, allowances, deductions, effective_from.
- **PayrollRun**: run_month, status.
- **Payslip**: payroll_run_ref, employee_ref, gross, net, breakdown.

### Action (Intents)
- Upsert salary profile.
- Execute payroll run for a month.
- List/search payroll & payslips.
- Export payslips (ZIP/PDF) and payroll CSV.

### Data (Conceptual)
- Entities: `SalaryProfile`, `PayrollRun`, `Payslip`.
- Relationships: `PayrollRun` 1:N `Payslip`; `Employee` 1:N `SalaryProfile`.

---

## 7) Dashboard

### Behavior (MVP)
- Key stats: total employees, on leave today, pending approvals, meetings this week.
- Recent activity & notifications with mark-as-read.

**vNext**: charts, trends, custom widgets.

### Model (Conceptual)
- Aggregations over other modules; no unique state.

### Action (Intents)
- Fetch dashboard metrics and recent activity.

### Data (Conceptual)
- Derived queries; no dedicated tables beyond audit/notifications.

---

## 8) Settings / Account

### Behavior (MVP)
- View/update profile, change password.
- Toggle theme (dark/light) and preferences.

**vNext**: 2FA, SSO, org-level settings.

### Model (Conceptual)
- **User** preferences JSON (theme, locale, timezone).

### Action (Intents)
- Read/update profile, password, and preferences.

### Data (Conceptual)
- Extend `User` with preferences.

---

## 9) Client App Structure (Vite + TS, Redux classic)

```
client/src/
  store/
    index.ts              # createStore/combineReducers + middleware (thunk)
    reducers/
      auth.ts
      notifications.ts
      theme.ts
      employees.ts
      attendance.ts
      meetings.ts
      payroll.ts
  api/                    # axios clients & helpers
  components/
    ui/
    layout/Sidebar.tsx
    layout/Topbar.tsx     # search, filters, export, bell, theme toggle
  features/
    employees/
    attendance/
    meetings/
    payroll/
    settings/
  routes/
    Dashboard.tsx
    Employees.tsx
    Attendance.tsx
    Meetings.tsx
    Payroll.tsx
    Settings.tsx
  styles/
    index.css             # Tailwind base + brand gradient utilities
  main.tsx
  App.tsx
```

### Redux Conventions
- Action creators (`actions/*.ts`) and reducers (`reducers/*.ts`).
- Thunks for async calls (`thunks/*.ts`) using axios.
- Typed hooks `useAppDispatch/useAppSelector`.
- Persist theme in localStorage; hydrate on app start.

---

## 10) Server App Structure (Express)

```
server/src/
  index.ts
  config/
    env.ts
    db.ts            # pg Pool / ORM client (optional)
    auth.ts          # JWT helpers
  middleware/
    authGuard.ts
    errorHandler.ts
  modules/
    employees/
    attendance/
    meetings/
    payroll/
    notifications/
    users/
  routes.ts          # composed by BMAD agent
```

### Middleware
- CORS, JSON parser, authGuard, errorHandler with a standard error shape.

> **BMAD Scope**: The BMAD agent will materialize concrete routes, controllers, validation schemas, and migrations based on the intents listed in each module.

---

## 11) Security & Compliance (MVP)
- Password hashing with `bcrypt`.
- JWTs: short-lived access, refresh strategy via HTTP-only cookie or header rotation.
- **RBAC**: only `ADMIN` can manage system-level configs; `HR` handles operations. No employee logins.
- File uploads: sanitize paths; store to disk/S3; virus-scan (vNext).

---

## 12) Incremental Roadmap
1. **Milestone A (Bootstrap)**: Auth (ADMIN + HR), RBAC, Theme, Notifications shell, layout.
2. **Milestone B (Employees + Search/Filter + Export CSV)**.
3. **Milestone C (Attendance/Leave + Export PDF)**.
4. **Milestone D (Meetings basic + notifications).**
5. **Milestone E (Payroll run + payslips CSV/PDF/ZIP).**
6. **Stabilize**: tests, perf, accessibility.

---

## 13) Testing Strategy
- **Server**: Jest + Supertest for actions generated by BMAD; contract tests.
- **Client**: Vitest + React Testing Library; reducers, thunks, components.

---

## 14) Dev & DX
- `.env` for server (DB URL, JWT secrets). `.env.local` for client API base.
- Prettier + ESLint; commit hooks via Husky & lint-staged.
- GitHub Actions (CI): build, test, type-check.

---

## 15) Branding Notes
- Use the gradient utility as the **primary brand surface** (buttons, hero, highlights):
  ```html
  <div class="rounded-2xl p-3 text-white bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500">HRWays</div>
  ```
- Neutral grayscale for content surfaces; accent CTAs with the gradient.

---

## 16) Open Questions (for vNext)
- Calendar sync provider(s): Google, Microsoft, CalDAV.
- ORM choice finalization: Prisma/Knex vs. raw queries.
- Multi-tenant support vs. single-tenant per deployment.
- PDF engine: `pdfkit` vs. `puppeteer` (HTML → PDF).

---

**End of specs • HRWays • BMAD MVP v1.1**
