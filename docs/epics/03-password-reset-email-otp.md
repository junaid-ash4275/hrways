# Epic: Password Reset (Email + OTP)

## Goal
Allow users to reset their password via email-delivered OTP with verification and a short-lived reset token.

## In Scope
- Request reset: generate OTP, email via SMTP, store hashed OTP with TTL/attempts
- Verify OTP: issue short-lived reset token
- Reset password: accept reset token + new password; single-use

## Out of Scope
- Branded email templates beyond basic MVP

## Key Outcomes
- Secure, user-friendly reset without exposing account existence

## User Stories
- As a user, I can request a password reset and receive an OTP by email
- As a user, I can verify OTP and obtain a reset token
- As a user, I can set a new password using the reset token (once)

## Acceptance Criteria
- Request returns 202 regardless of email existence; OTP TTL and attempt limits enforced
- Correct OTP returns reset token; invalid OTP increments attempts and eventually locks
- Reset with valid token updates password and invalidates token; audit logged

## Dependencies
- SMTP configuration; users table; auth hashing

## Non-Functional
- Hash OTP and tokens at rest; rate limit endpoints

## Metrics
- Reset success rate; OTP verification success/failure ratio

## Risks
- Email deliverability; mitigate with dev SMTP in local and provider in prod

## Release Slices
- MVP: plain text OTP email; simple templates later

