# Epic: Password Reset (Email + OTP) — User Stories

## HRW-RESET-1: Request Reset (OTP)
- Role: As a user
- Goal: I can request a password reset and receive an OTP via email.
- Acceptance Criteria:
  - Given I submit my email to POST /auth/request-reset, then response is 202 regardless of existence.
  - Given a valid account, when requested, then a 6-digit OTP is generated, stored hashed with TTL and attempts, and emailed.
  - OTP TTL is 10 minutes; max attempts is 5; further attempts return 429 until TTL expires.
  - Responses follow standard error shape.
- DoD: Endpoint, hashed OTP persistence, SMTP send, rate limit.
- Dependencies: SMTP, Users
- Priority: P1 | Estimate: TBD

## HRW-RESET-2: Verify OTP
- Role: As a user
- Goal: I can verify OTP and receive a short-lived reset token.
- Acceptance Criteria:
  - Given correct OTP, when I call POST /auth/verify-reset-otp, then I receive { resetToken, expiresAt }.
  - Given incorrect OTP, when attempts exceed limit, then request locks until TTL.
  - Reset token TTL is 15 minutes and is single-use.
  - Responses follow standard error shape.
- DoD: Endpoint, hashed compare, attempts tracking, token issuance.
- Dependencies: HRW-RESET-1
- Priority: P1 | Estimate: TBD

## HRW-RESET-3: Reset Password
- Role: As a user
- Goal: I can set a new password using the reset token.
- Acceptance Criteria:
  - Given valid resetToken, when I call POST /auth/reset with newPassword, then password updates and token invalidates (single use).
  - New password must meet policy: min 8 chars, at least one uppercase, one lowercase, and one digit; rejection returns 400 with details.
  - Responses follow standard error shape; action is audited.
- DoD: Endpoint, hashing, token invalidation, audit log entry.
- Dependencies: HRW-RESET-2
- Priority: P1 | Estimate: TBD

## HRW-RESET-4: Email Template & SMTP Config
- Role: As an admin
- Goal: OTP emails are readable and SMTP is easily configurable for dev.
- Acceptance Criteria:
  - Given dev environment, when using local SMTP (Papercut/MailHog), then OTP emails are delivered.
  - Given prod, when SMTP is configured, then emails send with from-address and basic template.
- DoD: Templated email, .env config, docs.
- Dependencies: SMTP
- Priority: P2 | Estimate: TBD
