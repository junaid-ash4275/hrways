# Epic: Settings / Account — User Stories

## HRW-SET-1: Profile View/Update
- Role: As a user
- Goal: I can view and update my profile fields.
- Acceptance Criteria:
  - Given profile fields, when I PUT /me/profile, then updates persist and reflect on next load.
- DoD: Endpoint; validation.
- Dependencies: Users
- Priority: P2 | Estimate: TBD

## HRW-SET-2: Change Password (Authenticated)
- Role: As a user
- Goal: I can change my password using my current password.
- Acceptance Criteria:
  - Given correct current password, when I POST /me/change-password, then password changes.
  - Given incorrect current password, then 400 with details.
  - New password must meet policy: min 8 chars, at least one uppercase, one lowercase, and one digit.
  - Responses follow standard error shape.
- DoD: Endpoint; hashing; validation.
- Dependencies: Auth
- Priority: P2 | Estimate: TBD

## HRW-SET-3: Preferences (Theme/Locale/Timezone)
- Role: As a user
- Goal: I can update preferences that the client rehydrates on login.
- Acceptance Criteria:
  - Given preferences JSON, when I PUT /me/preferences, then values persist and apply on next load.
  - Timezone values must be valid IANA names; invalid values return 400 with details.
- DoD: Endpoint; client persistence.
- Dependencies: Core Bootstrap
- Priority: P2 | Estimate: TBD

## HRW-SET-4: Preferences (Brand Gradient Variants)
- Role: As a user
- Goal: I can choose a brand gradient variant for the app and have it persist and apply globally.
- Acceptance Criteria:
  - Given a set of approved gradients [emerald (default), blue, orange, violet, rose], when I select one and save, the selection persists in preferences and is re-applied on login.
  - The selected gradient is applied consistently across the app (e.g., active nav, primary buttons, key highlights).
  - Invalid values are rejected with 400 and a validation error.
  - Changing the variant updates visuals without a full page reload (client state applies it immediately).
- DoD: UI selector with previews; server preference update; client rehydration and global application.
- Dependencies: Core Bootstrap
- Priority: P2 | Estimate: TBD
