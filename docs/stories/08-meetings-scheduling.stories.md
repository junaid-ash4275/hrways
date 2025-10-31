# Epic: Meetings & Scheduling — User Stories

## HRW-MEET-1: Create Meeting with Attendees
- Role: As HR
- Goal: I can create a meeting with title, time range, and attendees (employees, internal users, and/or external contacts).
- Acceptance Criteria:
  - Given valid fields and attendees, when I POST /meetings, then the meeting is created and attendees saved (including external contacts without requiring an account).
  - Time range validated: start_at < end_at.
  - At least one attendee is required; each attendee is one-of: employee_ref, user_ref, or external_contact { name (required), email (optional), phone (optional) }. Duplicates are prevented (by normalized email for external when provided, and by id for users/employees).
  - Responses follow standard error shape.
- DoD: Endpoint, attendee linking, validation, external contact capture.
- Dependencies: Employees (for employee attendees); none required for external contacts
- Priority: P1 | Estimate: TBD

## HRW-MEET-2: Update/Cancel Meeting
- Role: As HR
- Goal: I can update or cancel a meeting and notify attendees.
- Acceptance Criteria:
  - Given a meeting, when I PUT /meetings/:id or DELETE /meetings/:id, then attendees receive in-app notifications.
- DoD: Endpoints + notifications.
- Dependencies: Notifications Core
- Priority: P1 | Estimate: TBD

## HRW-MEET-3: List & Filter Meetings
- Role: As HR/Admin
- Goal: I can list meetings by date range or attendee.
- Acceptance Criteria:
  - Given date range/attendee filters, when I GET /meetings, then paginated results reflect filters.
  - Pagination response shape: { data, page, pageSize, total }; default sort by start_at asc.
- DoD: Endpoint + pagination.
- Dependencies: HRW-MEET-1
- Priority: P1 | Estimate: TBD
