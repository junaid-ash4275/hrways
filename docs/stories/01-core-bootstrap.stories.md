# Epic: Core Bootstrap — User Stories

## HRW-CORE-1: App Shell & Navigation
- Role: As a user (ADMIN/HR)
- Goal: I can see a consistent layout with sidebar/topbar and navigate to all sections.
- Acceptance Criteria:
  - Given I am authenticated, when I visit the app, then I see Sidebar (Dashboard, Employees, Attendance, Meetings, Payroll, Settings) and Topbar.
  - Given I click any section, when routing occurs, then the corresponding page scaffold renders without console errors.
  - Given an unknown route, when I navigate there, then I see a 404 page.
  - Basic accessibility: focus states on nav items; keyboard navigation between sections works.
- Definition of Done:
  - Routes wired; basic page scaffolds exist; 404 implemented.
  - No console errors on navigation.
- Dependencies: Auth & RBAC
- Priority: P1 | Estimate: TBD

## HRW-CORE-2: Role-Gated Routes & Menu
- Role: As an ADMIN/HR
- Goal: I only see and access routes/actions allowed by my role.
- Acceptance Criteria:
  - Given I am HR, when I try to access ADMIN-only area, then I see a 403 page.
  - Given my role, when the sidebar renders, then ADMIN-only links are hidden/disabled for HR.
- Definition of Done:
  - Route guard + role-based menu logic in place.
- Dependencies: Auth & RBAC
- Priority: P1 | Estimate: TBD

## HRW-CORE-3: Theme Toggle & Persistence
- Role: As a user
- Goal: I can switch between light/dark and it persists.
- Acceptance Criteria:
  - Given I toggle theme, when I reload, then the previous theme is applied from preferences.
  - Given I log in from another device, when preferences load, then the same theme applies.
- Definition of Done:
  - Theme stored in server-side user preferences and rehydrated on login.
- Dependencies: Users, Preferences API
- Priority: P1 | Estimate: TBD

## HRW-CORE-4: Error Boundary & Error Pages
- Role: As a user
- Goal: I see helpful pages for errors and forbidden access.
- Acceptance Criteria:
  - Given an unhandled UI error, when it occurs, then a generic error boundary UI renders.
  - Given insufficient permission, when I access a route, then a 403 page is shown.
- Definition of Done:
  - Error boundary, 403, and 404 pages implemented.
- Dependencies: None
- Priority: P2 | Estimate: TBD

## HRW-CORE-5: Client Config & Axios Base
- Role: As a developer
- Goal: The client has a centralized API base and interceptors.
- Acceptance Criteria:
  - Given API requests, when sent, then base URL and auth header are applied by default.
  - Given 401/403 responses, when received, then interceptors handle token refresh or redirect appropriately.
- Definition of Done:
  - Axios instance with interceptors; env-based API URL.
- Dependencies: Auth
- Priority: P2 | Estimate: TBD
