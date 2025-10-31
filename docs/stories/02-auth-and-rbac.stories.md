# Epic: Authentication & RBAC — User Stories

## HRW-AUTH-1: Login Endpoint & Flow
- Role: As a user
- Goal: I can log in with email/password and receive tokens.
- Acceptance Criteria:
  - Given valid credentials, when I call POST /auth/login, then I receive access and refresh tokens.
  - Given invalid credentials, when I call POST /auth/login, then I receive 401 with standard error shape.
  - Responses follow standard error shape: { error: { code, message, details? } }.
- DoD: Endpoint, hashing, parameterized SQL, tests for success/failure paths.
- Dependencies: Users table
- Priority: P1 | Estimate: TBD

## HRW-AUTH-2: Auth Guard Middleware
- Role: As a developer
- Goal: APIs require valid access token and verify role.
- Acceptance Criteria:
  - Given a protected route, when no/invalid token is provided, then 401 is returned.
  - Given insufficient role, when accessing a route, then 403 is returned.
  - 401/403 responses follow standard error shape.
- DoD: Middleware validates token and role, reusable in all modules.
- Dependencies: HRW-AUTH-1
- Priority: P1 | Estimate: TBD

## HRW-AUTH-3: Refresh & Logout
- Role: As a user
- Goal: Session continuity with refresh; ability to logout.
- Acceptance Criteria:
  - Given a valid refresh, when I call /auth/refresh, then a fresh access token is issued.
  - Given I logout, when I call /auth/logout, then refresh is invalidated.
- DoD: Refresh rotation, logout implementation.
- Dependencies: HRW-AUTH-1
- Priority: P2 | Estimate: TBD

## HRW-AUTH-4: Seed Admin Script
- Role: As an admin
- Goal: I can bootstrap the first ADMIN account.
- Acceptance Criteria:
  - Given DB is empty, when I run seed, then an ADMIN user is created with configured credentials.
- DoD: CLI or npm script, idempotent.
- Dependencies: Users table
- Priority: P1 | Estimate: TBD

## HRW-AUTH-5: Client Auth State & Protected Routes
- Role: As a user
- Goal: I stay logged in across navigations and see protected pages.
- Acceptance Criteria:
  - Given valid tokens, when I browse, then protected routes render.
  - Given token expired, when interceptor refreshes, then browsing continues without logout.
- DoD: Redux auth slice, route guards, axios interceptors.
- Dependencies: HRW-AUTH-1/2/3
- Priority: P1 | Estimate: TBD
