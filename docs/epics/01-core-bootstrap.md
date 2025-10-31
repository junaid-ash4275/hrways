# Epic: Core Bootstrap (App Shell, Theming, Navigation)

## Goal
Deliver a functional app shell with authenticated layout, primary navigation, theme toggle, error handling, and groundwork for feature modules.

## In Scope
- App layout (Sidebar, Topbar) with sections: Dashboard, Employees, Attendance, Meetings, Payroll, Settings
- Dark/light theme toggle persisted to user preferences
- Router skeleton and guarded routes (ADMIN/HR)
- Global error boundary and toasts area; empty states/404/403

## Out of Scope
- Feature business logic (handled in feature epics)
- Advanced accessibility polish beyond baseline

## Key Outcomes
- Consistent UI shell across all routes
- Theme persists across sessions and devices (via preferences)

## User Stories
- As a user, I can switch theme and see it persist on next login
- As a user, I can navigate to each section via sidebar
- As a user, I see a helpful 404 when route not found
- As a user, I see a 403 when I lack permission

## Acceptance Criteria
- Theme toggle updates UI immediately and persists in preferences
- Routes exist for all main sections and render page scaffolds
- Unauthorized access shows 403; unknown route shows 404

## Dependencies
- Auth & RBAC (login state, role)

## Non-Functional
- Responsive navigation; keyboard support for core navigation

## Metrics
- 100% routes wired; zero console errors on navigation

## Risks
- Over-customizing shell early; mitigate by keeping simple and modular

## Release Slices
- MVP: shell + routes + theme persistence
- vNext: breadcrumbs, quick actions, command palette

