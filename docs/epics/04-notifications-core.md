# Epic: Notifications Core (In-App)

## Goal
Provide an in-app notifications list with unread counts and mark-read/all-read actions.

## In Scope
- Notifications API: list (paginated), mark-read, mark-all-read
- Client notifications bell and dropdown/list with unread badge

## Out of Scope
- Email/push notifications (vNext)

## Key Outcomes
- Users can see relevant events and manage unread state

## User Stories
- As a user, I can open a notifications list with recent items
- As a user, I can mark one or all notifications as read
- As a user, I see an unread count on the bell icon

## Acceptance Criteria
- List returns paginated items sorted by created_at desc
- Mark-read mutates state and unread count updates in UI
- Mark-all-read updates count to zero

## Dependencies
- Auth & RBAC; notifications table

## Non-Functional
- Eventual consistency acceptable for count refresh

## Metrics
- Time to first notification render; count update latency

## Risks
- Overloading list with verbose messages; keep concise and typed

## Release Slices
- MVP: list + counts + read actions
- vNext: deep links, categories, grouping

