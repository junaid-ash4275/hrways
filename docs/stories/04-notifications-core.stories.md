# Epic: Notifications Core — User Stories

## HRW-NOTIF-1: List Notifications (Paginated)
- Role: As a user
- Goal: I can view recent notifications with pagination.
- Acceptance Criteria:
  - Given I call GET /notifications?page=1&pageSize=20, then I receive items sorted by created_at desc and total count.
  - Only the authenticated user's notifications are returned (scoped by user_id).
  - Responses follow standard error shape.
- DoD: Endpoint, ordering, pagination response shape.
- Dependencies: Users, notifications table
- Priority: P1 | Estimate: TBD

## HRW-NOTIF-2: Mark Read
- Role: As a user
- Goal: I can mark an item as read and update the count.
- Acceptance Criteria:
  - Given a notification id, when I call POST /notifications/mark-read, then the item is marked read and count decreases.
  - Idempotent: re-marking a read item is a no-op and returns 200.
  - Responses follow standard error shape.
- DoD: Endpoint, UI update, idempotency.
- Dependencies: HRW-NOTIF-1
- Priority: P1 | Estimate: TBD

## HRW-NOTIF-3: Mark All Read
- Role: As a user
- Goal: I can mark all notifications as read.
- Acceptance Criteria:
  - Given I call POST /notifications/mark-all-read, then unread count becomes zero and list reflects state.
  - Responses follow standard error shape.
- DoD: Endpoint, efficient bulk update.
- Dependencies: HRW-NOTIF-1
- Priority: P2 | Estimate: TBD

## HRW-NOTIF-4: Client Bell & Badge
- Role: As a user
- Goal: I can open a list from a bell icon with an unread badge.
- Acceptance Criteria:
  - Given unread items exist, when the header renders, then badge shows the count.
-  Given I open the list, when I mark an item read, then badge decrements.
- DoD: UI component, slice/state for count.
- Dependencies: HRW-NOTIF-1/2
- Priority: P1 | Estimate: TBD
