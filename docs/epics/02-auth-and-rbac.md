# Epic: Authentication & RBAC

## Goal
Provide secure login/logout/refresh with JWT, and enforce ADMIN/HR roles across UI and API.

## In Scope
- Email/password login (bcrypt)
- Access token (short-lived) + refresh token rotation
- Role-gated routes and UI elements (ADMIN vs HR)

## Out of Scope
- SSO/2FA (vNext)

## Key Outcomes
- Only authorized users access protected resources; role checks are enforced

## User Stories
- As a user, I can log in with email/password and access protected pages
- As a user, I remain logged in during a session (token refresh)
- As an ADMIN, I can access system-level settings that HR cannot
- As an HR, I am prevented from accessing ADMIN-only areas

## Acceptance Criteria
- Valid credentials return access + refresh tokens; invalid returns 401 with standard error shape
- Protected endpoints reject unauthenticated (401) and unauthorized (403) access
- Role-gated UI hides or disables restricted actions

## Dependencies
- Core Bootstrap (guarded routes)
- Users table and seed admin

## Non-Functional
- Parameterized SQL; consistent error shape; rate limit login endpoint

## Metrics
- Successful login rate; low 401/403 noise for legitimate users

## Risks
- Token leakage; mitigate with secure storage and short TTL

## Release Slices
- MVP: email/password + RBAC
- vNext: SSO/2FA

