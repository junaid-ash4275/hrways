# Epic: Scheduled Notifications — Birthdays & Work Anniversaries

## Goal
Automatically create in-app notifications each day for employee birthdays and work anniversaries, using org timezone.

## In Scope
- Daily scheduler (ORG_TZ, scheduled time) to generate notifications
- Birthday rule: birth_date matches today (MM-DD)
- Anniversary rule: join_date matches today (MM-DD) and years >= 1; include years in metadata
- De-dup: one notification per employee/event/day

## Out of Scope
- Email digests (vNext)

## Key Outcomes
- Timely recognition of birthdays and anniversaries for HR/Admin

## User Stories
- As an HR/Admin, I receive a notification for today’s birthdays
- As an HR/Admin, I receive a notification for work anniversaries including years

## Acceptance Criteria
- Scheduler runs at configured local time (ORG_TZ), DST-safe
- Notifications created only once per employee per applicable day
- Notifications appear in core list and affect unread counts

## Dependencies
- Notifications Core; employees table with birth_date and join_date

## Non-Functional
- Efficient queries; O(N) daily with appropriate indexes

## Metrics
- Count of generated notifications vs expected employee matches

## Risks
- Timezone edge cases; validate with test clock and sample data

## Release Slices
- MVP: daily generation; manual trigger script for testing
- vNext: upcoming events preview, email digest

