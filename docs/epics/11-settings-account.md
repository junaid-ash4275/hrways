# Epic: Settings / Account

## Goal
Allow users to view/update profile, change password (when authenticated), and manage preferences (theme, locale, timezone).

## In Scope
- Profile view/edit
- Change password (current password required)
- Preferences read/update (theme, locale, timezone, brand gradient variant)

## Out of Scope
- Organization/global settings (vNext)

## Key Outcomes
- Users can self-serve basic account management tasks

## User Stories
- As a user, I can update my profile fields
- As a user, I can change my password securely
- As a user, I can set my theme, brand color (gradient variant), and timezone

## Acceptance Criteria
- Profile updates validate and persist; password change validates current password and policy
- Preferences persist and rehydrate on login
- Brand gradient can be selected from approved variants and applies globally to active states, CTAs, and highlights
- Approved variants: emerald (default), blue, orange, violet, rose
- Invalid variant values are rejected

## Dependencies
- Auth; users table with preferences
  - `users.preferences.brandVariant` (enum of approved gradients)

## Non-Functional
- Input validation; consistent error shape
- Accessibility: maintain sufficient color contrast across all brand variants

## Metrics
- Profile update success rate; minimal 4xx for well-formed requests

## Risks
- Preference drift between client and server; rely on server as source of truth

## Release Slices
- MVP: profile/password/preferences
- vNext: org-level settings
