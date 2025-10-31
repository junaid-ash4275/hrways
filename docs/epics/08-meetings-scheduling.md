# Epic: Meetings & Scheduling

## Goal
Support creation, update, and cancellation of meetings with attendee tracking and in-app notifications.

## In Scope
- Meetings CRUD with title, time range, location, organizer
- Attendees: employees, internal users, and/or external contacts (guests)
- In-app notifications to attendees upon cancel (create/update in vNext)
- List/filter by date range and attendee; CSV export

## Out of Scope
- External calendar sync, recurring meetings (vNext)

## Key Outcomes
- Simple internal scheduling visible to HR/Admin

## User Stories
- As HR, I can create a meeting with attendees
- As HR, I can edit or cancel a meeting and notify attendees
- As HR/Admin, I can filter upcoming meetings and export CSV

## Acceptance Criteria
- Time range validated (start_at < end_at)
- At least one attendee is required
- Each attendee is one-of: employee_ref, user_ref, or external_contact { name (required), email (optional), phone (optional) }
- Duplicates are prevented (by id for users/employees; by normalized email for external contacts when provided)
- Notifications generated on cancel (create/update in vNext)
- List supports date/attendee filters and pagination
- UI: Default Month view calendar; clicking a day opens a day list; clicking a meeting opens a details drawer with attendees and Cancel action.
- UI: New Meeting modal provides Internal tab (multi-select employee search) and External tab (single external contact capture)

## Dependencies
- Notifications Core; employees module (for employee attendees); none required for external contacts

## Non-Functional
- Stable list performance; consistent error handling

## Metrics
- % of updates that deliver attendee notifications successfully

## Risks
- Attendee duplication across types; ensure uniqueness by (meeting, attendee) with normalized email for externals

## Release Slices
- MVP: CRUD + attendees + notifications + CSV
- vNext: external sync, recurrence
