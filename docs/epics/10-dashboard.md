# Epic: Dashboard

## Goal
Provide a high-level view of KPIs (employees, on leave, pending approvals, meetings this week) and recent activity.

## In Scope
- KPI cards sourced from aggregated queries
- Recent activity stream and link-through to records

## Out of Scope
- Complex charts/trends (vNext)

## Key Outcomes
- Fast awareness of current workforce status

## User Stories
- As a user, I can see today’s key counts at a glance
- As a user, I can review recent activity and open related records

## Acceptance Criteria
- KPIs reflect fresh data after underlying mutations
- Activity list paginates and links work

## Dependencies
- Employees, Attendance/Leave, Meetings modules

## Non-Functional
- Fast queries with modest caching where helpful

## Metrics
- Dashboard loads under 1s (warm) at MVP scale

## Risks
- Over-aggregation causing slow loads; keep minimal and pragmatic

## Release Slices
- MVP: KPIs + activity list
- vNext: charts/trends

